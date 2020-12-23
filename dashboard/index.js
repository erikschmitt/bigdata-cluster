const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')

const app = express()

const cacheTimeSecs = 15

// -------------------------------------------------------
// Command-line options
// -------------------------------------------------------

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mysql-host <host>', 'MySQL host', 'my-app-mysql-service')
	.option('--mysql-port <port>', 'MySQL port', 33060)
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'sentence')
	.option('--mysql-username <username>', 'MySQL username', 'root')
	.option('--mysql-password <password>', 'MySQL password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

const dbConfig = {
	host: options.mysqlHost,
	port: options.mysqlPort,
	user: options.mysqlUsername,
	password: options.mysqlPassword,
	schema: options.mysqlSchema
};
/**
 * Ausführung eines SQL-Query mittels mysql/xdevapi
 * @param {string} query 
 * @param {Array<string>} data 
 */
async function executeQuery(query, data) {
	let session = await mysqlx.getSession(dbConfig);
	if (typeof data == 'undefined'){
		console.log('typeof data == undefined')
		return await session.sql(query).execute()
	} else {
		console.log('execute query with data')
		return await session.sql(query, data).bind(data).execute()
	}
	
}

// -------------------------------------------------------
// Memache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers", e)
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns()
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}

// -------------------------------------------------------
// HTML helper to send a response to the client
// -------------------------------------------------------

function sendResponse(res, html) {
	
	res.send(`<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Sentiment Analysis Dashboard</title>
					<link rel="icon" href="data:,">
				
					<!--Import materialize.css-->
					<link rel="stylesheet" href="/static/materialize.min.css" type="text/css">
					<!--Import Custom Styles-->
					<link href="/static/style.css" type="text/css" rel="stylesheet" media="screen,projection" />
				</head>
				<body>
				<header><div class="navbar-fixed"><nav>
						<div class="nav-wrapper brown darken-4"><span class="brand-logo">Sentiment Analyses with Spark - Game of Thrones Subtitles</span></div>
					</nav></div></header>
					${html}
					<!--Import external JS-->
					<script src="/static/materialize.min.js"></script>
					<script src="/static/core.js"></script>
					<script src="/static/charts.js"></script>
					<script src="/static/animated.js"></script>
					<script src="/static/script.js"></script>
				</body>
			</html>
		`)
}

/**
 * 
 * @param {*} timeStart 
 * @return {String} 
 */
function timeEnd(timeStart) {
	let time = process.hrtime(timeStart)
	return time[0] + "s " + time[1] / 1000000 + "ms"
}

/**
 * Load list of seasons
 */
async function getAllSeasons() {
	let timeStart = process.hrtime()
	const query = "SELECT * FROM allSeasons ORDER BY season ASC"
	const key = 'allSeasons'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ season : row[0] }))
		if (data) {
			console.log(`Got ${Object.keys(data).length} for ${key} => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);
			
			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No seasons found"
		}
	}
}

/**
 * Load chart data of all seasons
 */
async function getChartAllSeasons() {
	let timeStart = process.hrtime()
	const query = "Select * FROM allSeasonsChart ORDER BY season ASC"
	const key = 'chartAllSeasons'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} seasons found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ category : "Staffel " + row[0],
							negative1: row[1]*(-1),
							negative2: row[2]*(-1),
							positive1: row[3],
							positive2: row[4]  }))
		
		if (data) {
			console.log(`Got ${Object.keys(data).length} for ${key} => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No seasons found"
		}
	}
}

/**
 * Load list of all people
 */
async function getAllPeople() {
	let timeStart = process.hrtime()
	const query = "SELECT * FROM allPeople ORDER BY person ASC"
	const key = 'allPeople'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ name : row[0] }))
		if (data) {
			console.log(`Got ${Object.keys(data).length} for ${key} => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Load chart data of all people
 */
async function getChartAllPeople() {
	let timeStart = process.hrtime()
	const query = "Select * FROM allPeopleChart ORDER BY person ASC"
	const key = 'chartAllPeople'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} people found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ category : row[0],
							negative1: row[1]*(-1),
							negative2: row[2]*(-1),
							positive1: row[3],
							positive2: row[4] }))
		
		if (data) {
			console.log(`Got ${Object.keys(data).length} for ${key} => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Load list of people, wich speaks in specific season
 * @param {string} season number of season
 */
async function getPeopleOfSeason(season) {
	let timeStart = process.hrtime()
	const query = "SELECT DISTINCT person FROM sentence where season = ?"
	const key = 'peopleOfSeason_' + season
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [season]))
							.fetchAll()
							.map(row => ({ name : row[0] }))
		
		if (data) {
			console.log(`Got ${Object.keys(data).length} people for season ${season} in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Load chart data with sentiment of people, wich speaks in specific season
 * @param {string} season number of season
 */
async function getSentimentOfSeason(season) {
	let timeStart = process.hrtime()
	const query = "SELECT person, SUM(sentiment_group_n2) AS n2, SUM(sentiment_group_n1) AS n1, SUM(sentiment_group_p1) AS p1, SUM(sentiment_group_p2) AS p2 FROM sentiment_counts WHERE season = ? GROUP BY person;"
	const key = 'sentimentOfSeason_' + season
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} people found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [season]))
							.fetchAll()
							.map(row => ({ category : row[0],
								negative1: row[1]*(-1),
								negative2: row[2]*(-1),
								positive1: row[3],
								positive2: row[4]  }))
		
		if (data) {
			console.log(`Got ${Object.keys(data).length} sentiment for season ${season} in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Returns number of spoken sentences and participation in seasons
 * @param {string} person name of person
 */
async function getPerson(person) {
	let timeStart = process.hrtime()
	const query = "SELECT count(id) as CountSentence, count(DISTINCT(season)) AS CountSeasons FROM sentence where person like ?"
	const key = 'person_' + person.replace(/ /gi, "_");
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${cachedata.toString()}data found`)
		return { ...cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [person])).fetchOne()
		
		if (data) {
			let result = { countSentence : data[0], countSeasons  : data[1]  }
			console.log(`Got countSentence: ${result.countSentence} and countSeasons: ${result.countSeasons} for ${person}  in database => now store in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);

			return { ...result, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "Person not found"
		}
	}
}

/**
 * Returns number of spoken sentences and participation in seasons
 * @param {string} person name of person
 */
async function getChartPerson(person) {
	let timeStart = process.hrtime()
	const query = "SELECT season, SUM(sentiment_group_n2) AS n2, SUM(sentiment_group_n1) AS n1, SUM(sentiment_group_p1) AS p1, SUM(sentiment_group_p2) AS p2 FROM sentiment_counts WHERE person like ? GROUP BY season;"
	const key = 'chartPerson_' + person.replace(/ /gi, "_");
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, data found`)
		return { result: cachedata, cached: true, execTime: timeEnd(timeStart) }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [person]))
							.fetchAll()
							.map(row => ({ category : "Staffel "+row[0],
								negative1: row[1]*(-1),
								negative2: row[2]*(-1),
								positive1: row[3],
								positive2: row[4]  }))

		if (data) {
			console.log(`Got ${Object.keys(data).length} sentiment for ${person} in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			return { result: data, cached: false, execTime: timeEnd(timeStart) }
		} else {
			throw "Person not found"
		}
	}
}

// -------------------------------------------------------
// Start page
// -------------------------------------------------------


// Return HTML for start page
app.get("/", (req, res) => {

	Promise.all([getAllSeasons(), getAllPeople(), getChartAllPeople(), getChartAllSeasons()]).then(values => {
		const season = values[0]
		const people = values[1]
		const chart = values[2]
		const chart2 = values[3]
		const peopleChart = chart.result
		const seasonChart = chart2.result

		const seasonsHtml = season.result
			.map(seas => `<li class="collection-item"> <a href='season/${seas.season}' target='_blank'>Staffel ${seas.season}</a></li>`)
			.join("\n")
		
		const peopleHtml = people.result
			.map(p => `<li class="collection-item"> <a href='person/${p.name}' target='_blank'>${p.name}</a></li>`)
			.join("\n")

		const html =`			
						
				<main>
					<div class="row" id="season">
						<div class="col s2">
							<ul class="collection with-header">
								<li class="collection-header"><h4>Staffeln</h4></li>
								${seasonsHtml}
							</ul>
						</div>
						<div class="col s10">
							<h1>Anzahl Sätze je Staffel mit Sentimentgruppen</h1>
							<div id="sentimentbar"></div>
						</div>
					</div>
					<hr>
					<div class="row" id="person">
						<div class="col s2">
							<ul class="collection with-header">
								<li class="collection-header"><h4>Personen</h4></li>
								${peopleHtml}
							</ul>
						</div>
						<div class="col s10">
							<h1>Anzahl Sätze von Personen gruppiert in Sentimentgruppen</h1>
							<div id="stackedbars"></div>
						</div>
					</div>
			
				</main>
				<footer>
				<hr>
				<h3 id="info">Information about the generated page</h3>
				<table>
					<tr><td>Server:</td><td>${os.hostname()}</td><td>Date:</td><td>${new Date()}</td></tr>
					<tr><td>Using ${memcachedServers.length} memcached Servers:</td><td>${memcachedServers}</td></tr>
					<tr><td>Cached result seasons list:</td><td>${season.cached}</td><td>Response time seasons list:</td><td>${season.execTime}</td></tr>
					<tr><td>Cached result people list:</td><td>${people.cached}</td><td>Response time people list:</td><td>${people.execTime}</td></tr>
					<tr><td>Cached result people chart:</td><td>${chart.cached}</td><td>Response time people chart:</td><td>${chart.execTime}</td></tr>
				</table>
				</footer>
				<script>
					// Create chart instance
					function createChart(){
						var chart = am4core.create("sentimentbar", am4charts.XYChart);

						// Title
						var title1 = chart.titles.push(new am4core.Label());
						title1.text = "Anzahl Sätze von Personen gruppiert in Sentimentgruppen";
						title1.fontSize = 25;
						title1.marginBottom = 15;

						// Add data
						chart.data = ${JSON.stringify(seasonChart)};

						// Create axes
						var categoryAxis1 = chart.yAxes.push(new am4charts.CategoryAxis());
						categoryAxis1.dataFields.category = "category";
						categoryAxis1.renderer.grid.template.location = 0;
						categoryAxis1.renderer.inversed = true;
						categoryAxis1.renderer.minGridDistance = 20;
						categoryAxis1.renderer.axisFills.template.disabled = false;
						categoryAxis1.renderer.axisFills.template.fillOpacity = 0.05;

						var valueAxis1 = chart.xAxes.push(new am4charts.ValueAxis());
						valueAxis1.min = -5000;
						valueAxis1.max = 5000;
						valueAxis1.renderer.minGridDistance = 50;
						valueAxis1.renderer.ticks.template.length = 5;
						valueAxis1.renderer.ticks.template.disabled = false;
						valueAxis1.renderer.ticks.template.strokeOpacity = 0.4;
						valueAxis1.renderer.labels.template.adapter.add("text", function(text) {
						return text;
						})

						// Legend
						chart.legend = new am4charts.Legend();
						chart.legend.position = "right";

						// Use only absolute numbers
						chart.numberFormatter.numberFormat = "#.#s";

						// Create series
						function createSeries1(field, name, color) {
						var series1 = chart.series.push(new am4charts.ColumnSeries());
						series1.dataFields.valueX = field;
						series1.dataFields.categoryY = "category";
						series1.stacked = true;
						series1.name = name;
						series1.stroke = color;
						series1.fill = color;
						
						var label1 = series1.bullets.push(new am4charts.LabelBullet);
						label1.label.text = "{valueX}";
						label1.label.fill = am4core.color("#fff");
						label1.label.strokeWidth = 0;
						label1.label.truncate = false;
						label1.label.hideOversized = true;
						label1.locationX = 0.5;
						return series1;
						}

						var interfaceColors1 = new am4core.InterfaceColorSet();
						var positiveColor1 = interfaceColors1.getFor("positive");
						var negativeColor1 = interfaceColors1.getFor("negative");

						createSeries1("negative2", "eher negativ", negativeColor1.lighten(0.5));
						createSeries1("negative1", "negativ", negativeColor1);
						createSeries1("positive1", "eher positiv", positiveColor1.lighten(0.5));
						createSeries1("positive2", "positiv", positiveColor1);

						chart.legend.events.on("layoutvalidated", function(event){
						chart.legend.itemContainers.each((container)=>{
							if(container.dataItem.dataContext.name == "Never"){
							container.toBack();
							}
						})
						})

						var chart2 = am4core.create("stackedbars", am4charts.XYChart);

						// Title
						var title = chart2.titles.push(new am4core.Label());
						title.text = "Anzahl Sätze von Personen gruppiert in Sentimentgruppen";
						title.fontSize = 25;
						title.marginBottom = 15;

						// Add data
						chart2.data = ${JSON.stringify(peopleChart)};

						// Create axes
						var categoryAxis = chart2.yAxes.push(new am4charts.CategoryAxis());
						categoryAxis.dataFields.category = "category";
						categoryAxis.renderer.grid.template.location = 0;
						categoryAxis.renderer.inversed = true;
						categoryAxis.renderer.minGridDistance = 20;
						categoryAxis.renderer.axisFills.template.disabled = false;
						categoryAxis.renderer.axisFills.template.fillOpacity = 0.05;

						var valueAxis = chart2.xAxes.push(new am4charts.ValueAxis());
						valueAxis.min = -900;
						valueAxis.max = 700;
						valueAxis.renderer.minGridDistance = 50;
						valueAxis.renderer.ticks.template.length = 5;
						valueAxis.renderer.ticks.template.disabled = false;
						valueAxis.renderer.ticks.template.strokeOpacity = 0.4;
						valueAxis.renderer.labels.template.adapter.add("text", function(text) {
						return text;
						})

						// Legend
						chart2.legend = new am4charts.Legend();
						chart2.legend.position = "right";

						// Use only absolute numbers
						chart2.numberFormatter.numberFormat = "#.#s";

						// Create series
						function createSeries(field, name, color) {
						var series = chart2.series.push(new am4charts.ColumnSeries());
						series.dataFields.valueX = field;
						series.dataFields.categoryY = "category";
						series.stacked = true;
						series.name = name;
						series.stroke = color;
						series.fill = color;
						
						var label = series.bullets.push(new am4charts.LabelBullet);
						label.label.text = "{valueX}";
						label.label.fill = am4core.color("#fff");
						label.label.strokeWidth = 0;
						label.label.truncate = false;
						label.label.hideOversized = true;
						label.locationX = 0.5;
						return series;
						}

						var interfaceColors = new am4core.InterfaceColorSet();
						var positiveColor = interfaceColors.getFor("positive");
						var negativeColor = interfaceColors.getFor("negative");

						createSeries("negative2", "eher negativ", negativeColor.lighten(0.5));
						createSeries("negative1", "negativ", negativeColor);
						createSeries("positive1", "eher positiv", positiveColor.lighten(0.5));
						createSeries("positive2", "positiv", positiveColor);

						chart2.legend.events.on("layoutvalidated", function(event){
						chart2.legend.itemContainers.each((container)=>{
							if(container.dataItem.dataContext.name == "Never"){
							container.toBack();
							}
						})
						})
					}
				</script>
		`
		sendResponse(res, html) 
	})
})

// -------------------------------------------------------
// Show data of specific season (from cache or DB)
// -------------------------------------------------------

app.get("/season/:season", (req, res) => {
	let season = req.params["season"]

	
	Promise.all([getPeopleOfSeason(season), getSentimentOfSeason(season)]).then(values => {
		const personOfSeason = values[0]
		const chart = values[1]
		const peopleChart = chart.result

		const peopleHtml = personOfSeason.result
		.map(p => `<li class="collection-item"> ${p.name}</li>`)
		.join("\n")

		const html =`			
				<main>
				<div class="row" id="person">
				<div class="col s2">
					<ul class="collection with-header">
						<li class="collection-header"><h4>Personen in Staffel ${season}</h4></li>
						${peopleHtml}
					</ul>
				</div>
				<div class="col s10">
					<h1>Anzahl Sätze von Personen gruppiert in Sentimentgruppen</h1>
					<div id="stackedbars"></div>
				</div>
			</div>
			
				</main>
				<footer>
				<hr>
				<h3>Information about the generated page</h3>
				<ul>
					<li>Server: ${os.hostname()}</li>
					<li>Date: ${new Date()}</li>
					<li>Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
					<li>Cached result list: ${personOfSeason.cached}</li>
					<li>Response time result list: ${personOfSeason.execTime}</li>
					<li>Cached result chart: ${chart.cached}</li>
					<li>Response time chart: ${chart.execTime}</li>
				</ul>
				</footer>
				<script>
				// Create chart instance
				function createChart(){
					var chart2 = am4core.create("stackedbars", am4charts.XYChart);

					// Title
					var title = chart2.titles.push(new am4core.Label());
					title.text = "Anzahl Sätze von Personen gruppiert in Sentimentgruppen";
					title.fontSize = 25;
					title.marginBottom = 15;

					// Add data
					chart2.data = ${JSON.stringify(peopleChart)};

					// Create axes
					var categoryAxis = chart2.yAxes.push(new am4charts.CategoryAxis());
					categoryAxis.dataFields.category = "category";
					categoryAxis.renderer.grid.template.location = 0;
					categoryAxis.renderer.inversed = true;
					categoryAxis.renderer.minGridDistance = 20;
					categoryAxis.renderer.axisFills.template.disabled = false;
					categoryAxis.renderer.axisFills.template.fillOpacity = 0.05;

					var valueAxis = chart2.xAxes.push(new am4charts.ValueAxis());
					valueAxis.min = -900;
					valueAxis.max = 700;
					valueAxis.renderer.minGridDistance = 50;
					valueAxis.renderer.ticks.template.length = 5;
					valueAxis.renderer.ticks.template.disabled = false;
					valueAxis.renderer.ticks.template.strokeOpacity = 0.4;
					valueAxis.renderer.labels.template.adapter.add("text", function(text) {
					return text;
					})

					// Legend
					chart2.legend = new am4charts.Legend();
					chart2.legend.position = "right";

					// Use only absolute numbers
					chart2.numberFormatter.numberFormat = "#.#s";

					// Create series
					function createSeries(field, name, color) {
					var series = chart2.series.push(new am4charts.ColumnSeries());
					series.dataFields.valueX = field;
					series.dataFields.categoryY = "category";
					series.stacked = true;
					series.name = name;
					series.stroke = color;
					series.fill = color;
					
					var label = series.bullets.push(new am4charts.LabelBullet);
					label.label.text = "{valueX}";
					label.label.fill = am4core.color("#fff");
					label.label.strokeWidth = 0;
					label.label.truncate = false;
					label.label.hideOversized = true;
					label.locationX = 0.5;
					return series;
					}

					var interfaceColors = new am4core.InterfaceColorSet();
					var positiveColor = interfaceColors.getFor("positive");
					var negativeColor = interfaceColors.getFor("negative");

					createSeries("negative2", "eher negativ", negativeColor.lighten(0.5));
					createSeries("negative1", "negativ", negativeColor);
					createSeries("positive1", "eher positiv", positiveColor.lighten(0.5));
					createSeries("positive2", "positiv", positiveColor);

					chart2.legend.events.on("layoutvalidated", function(event){
					chart2.legend.itemContainers.each((container)=>{
						if(container.dataItem.dataContext.name == "Never"){
						container.toBack();
						}
					})
					})
				}
				</script>
		`
		sendResponse(res, html) 
	})

});

// -------------------------------------------------------
// Show data of specific person (from cache or DB)
// -------------------------------------------------------

app.get("/person/:person", (req, res) => {
	let person = req.params["person"]

	Promise.all([getPerson(person), getChartPerson(person)]).then(values => {
		const personData = values[0]
		const chart = values[1]
		const personChart = chart.result

		const html =`
				<main>
					<div class="row" id="staticData">
						<div class="col s3">
							<h4>${person}</h4>
							<table>
								<tbody>
									<tr><td>Anzahl Sätze</td><td>${personData.countSentence}</td></tr>
									<tr><td>Anzahl teilgenommener Staffeln</td><td>${personData.countSeasons}</td></tr>
								</tbody>
							</table>
					  	</div>
						<div class="col s9">
						<h1>Anzahl Sätze von ${person} je Staffel nach Sentimentgruppen</h1>
						<div id="stackedbars"></div>
						</div>
					</div>
				</main>
				<footer>
				<hr>
				<h3>Information about the generated page</h3>
				<ul>
					<li>Server: ${os.hostname()}</li>
					<li>Date: ${new Date()}</li>
					<li>Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
					<li>Cached result list: ${personData.cached}</li>
					<li>Response time result list: ${personData.execTime}</li>
					<li>Cached result chart: ${chart.cached}</li>
					<li>Response time result chart: ${chart.execTime}</li>
				</ul>
				</footer>
				<script>
					// heatmap
					function createChart(){
						var chart2 = am4core.create("stackedbars", am4charts.XYChart);
	
						// Title
						var title = chart2.titles.push(new am4core.Label());
						title.text = "Anzahl Sätze von Personen gruppiert in Sentimentgruppen";
						title.fontSize = 25;
						title.marginBottom = 15;
	
						// Add data
						chart2.data = ${JSON.stringify(personChart)};
	
						// Create axes
						var categoryAxis = chart2.yAxes.push(new am4charts.CategoryAxis());
						categoryAxis.dataFields.category = "category";
						categoryAxis.renderer.grid.template.location = 0;
						categoryAxis.renderer.inversed = true;
						categoryAxis.renderer.minGridDistance = 20;
						categoryAxis.renderer.axisFills.template.disabled = false;
						categoryAxis.renderer.axisFills.template.fillOpacity = 0.05;
	
						var valueAxis = chart2.xAxes.push(new am4charts.ValueAxis());
						valueAxis.min = -900;
						valueAxis.max = 700;
						valueAxis.renderer.minGridDistance = 50;
						valueAxis.renderer.ticks.template.length = 5;
						valueAxis.renderer.ticks.template.disabled = false;
						valueAxis.renderer.ticks.template.strokeOpacity = 0.4;
						valueAxis.renderer.labels.template.adapter.add("text", function(text) {
						return text;
						})
	
						// Legend
						chart2.legend = new am4charts.Legend();
						chart2.legend.position = "right";
	
						// Use only absolute numbers
						chart2.numberFormatter.numberFormat = "#.#s";
	
						// Create series
						function createSeries(field, name, color) {
						var series = chart2.series.push(new am4charts.ColumnSeries());
						series.dataFields.valueX = field;
						series.dataFields.categoryY = "category";
						series.stacked = true;
						series.name = name;
						series.stroke = color;
						series.fill = color;
						
						var label = series.bullets.push(new am4charts.LabelBullet);
						label.label.text = "{valueX}";
						label.label.fill = am4core.color("#fff");
						label.label.strokeWidth = 0;
						label.label.truncate = false;
						label.label.hideOversized = true;
						label.locationX = 0.5;
						return series;
						}
	
						var interfaceColors = new am4core.InterfaceColorSet();
						var positiveColor = interfaceColors.getFor("positive");
						var negativeColor = interfaceColors.getFor("negative");
	
						createSeries("negative2", "eher negativ", negativeColor.lighten(0.5));
						createSeries("negative1", "negativ", negativeColor);
						createSeries("positive1", "eher positiv", positiveColor.lighten(0.5));
						createSeries("positive2", "positiv", positiveColor);
	
						chart2.legend.events.on("layoutvalidated", function(event){
						chart2.legend.itemContainers.each((container)=>{
							if(container.dataItem.dataContext.name == "Never"){
							container.toBack();
							}
						})
						})
					}
				</script>
		`
		sendResponse(res, html) 
	})

});

// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});
