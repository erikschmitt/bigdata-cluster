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
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'popular')
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
					<title>Dashboard</title>
					<link rel="icon" href="data:,">
				
					<!--Import Google Icon Font-->
					<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
					<!--Import materialize.css-->
					<link rel="stylesheet" href="/static/materialize.min.css" type="text/css">
					<!--Import Custom Styles-->
					<link href="/static/style.css" type="text/css" rel="stylesheet" media="screen,projection" />
				</head>
				<body>
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
 * Load list of seasons
 */
async function getAllSeasons() {
	let timeStart = process.hrtime()
	const query = "SELECT * FROM allSeasons ORDER BY n_season DESC"
	const key = 'allSeasons'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} seasons found`)
		let timeEnd = process.hrtime(timeStart)
		let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
		return { result: cachedata, cached: true, execTime: timeResponse }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ season : row[0] }))
		if (data) {
			console.log(`Got ${Object.keys(data).length} seasons in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);
			
			let timeEnd = process.hrtime(timeStart)
			let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
			return { result: data, cached: false, execTime: timeResponse }
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
	const query = "SELECT * FROM allPeople ORDER BY person DESC"
	const key = 'allPeople'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} people found`)
		let timeEnd = process.hrtime(timeStart)
		let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
		return { result: cachedata, cached: true, execTime: timeResponse }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query))
						.fetchAll()
						.map(row => ({ name : row[0] }))
		if (data) {
			console.log(`Got ${Object.keys(data).length} people in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			let timeEnd = process.hrtime(timeStart)
			let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
			return { result: data, cached: false, execTime: timeResponse }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Load list of people, wich speaks in specific season
 * @param {string} season 
 */
async function getPeopleOfSeason(season) {
	let timeStart = process.hrtime()
	const query = "SELECT DISTINCT person FROM sentence where n_season = ?"
	const key = 'peopleOfSeason_' + season
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${Object.keys(cachedata).length} people found`)
		let timeEnd = process.hrtime(timeStart)
		let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms";
		return { result: cachedata, cached: true, execTime: timeResponse }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [season]))
							.fetchAll()
							.map(row => ({ name : row[0] }))
		
		if (data) {
			console.log(`Got ${Object.keys(data).length} people for season ${season} in database => now store in cache`)
			if (memcached)
				await memcached.set(key, data, cacheTimeSecs);

			let timeEnd = process.hrtime(timeStart)
			let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
			return { result: data, cached: false, execTime: timeResponse }
		} else {
			throw "No people found"
		}
	}
}

/**
 * Returns number of spoken sentences and participation in seasons
 * @param {string} person 
 */
async function getPerson(person) {
	let timeStart = process.hrtime()
	const query = "SELECT count(sentence) as CountSentence, count(DISTINCT(n_season)) AS CountSeasons FROM sentence where person like ?"
	const key = 'person_' + person.replace(/ /gi, "_");
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, ${cachedata.toString()}data found`)
		let timeEnd = process.hrtime(timeStart)
		let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
		return { ...cachedata, cached: true, execTime: timeResponse }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [person])).fetchOne()
		
		if (data) {
			let result = { countSentence : data[0], countSeasons  : data[1]  }
			console.log(`Got countSentence: ${result.countSentence} and countSeasons: ${result.countSeasons} in database => now store in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);

			let timeEnd = process.hrtime(timeStart)
			let timeResponse = timeEnd[0] + "s " + timeEnd[1] / 1000000 + "ms"
			return { ...result, cached: false, execTime: timeResponse }
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

	Promise.all([getAllSeasons(), getAllPeople()]).then(values => {
		const season = values[0]
		const people = values[1]

		const seasonsHtml = season.result
			.map(seas => `<li class="collection-item"> <a href='season/${seas.season}' target='_blank'>Staffel ${seas.season}</a></li>`)
			.join("\n")
		
		const peopleHtml = people.result
			.map(p => `<li class="collection-item"> <a href='person/${p.name}' target='_blank'>${p.name}</a></li>`)
			.join("\n")

		const peopleChart = people.result
			.map(p =>  {
				return {
					category: p.name,
					negative1: (Math.floor((Math.random() * 4500) + 1))*(-1),
					negative2: (Math.floor((Math.random() * 4500) + 1))*(-1),
					positive1: (Math.floor((Math.random() * 3000) + 1)),
					positive2: (Math.floor((Math.random() * 3000) + 1))
				}
			})

		const html =`			
				<header>
					<div class="navbar-fixed">
					<nav>
						<div class="nav-wrapper brown darken-4">
							<a href="#" class="brand-logo">GoT</a>
							<ul id="nav-mobile" class="right hide-on-med-and-down">
								<li><a href="./#season">Staffeln</a></li>
								<li><a href="./#person">Personen</a></li>
								<li><a href="./#info">Info</a></li>
							</ul>
						</div>
					</nav>
					</div>
				</header>
			
				<main>
					<div class="row" id="season">
						<div class="col s2">
							<ul class="collection with-header">
								<li class="collection-header"><h4>Staffeln</h4></li>
								${seasonsHtml}
							</ul>
						</div>
						<div class="col s10">
							<h1>Anzahl Sätze von Personen in Staffel X mit Sentimentgruppen</h1>
							<div id="hybridpiebar"></div>
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
				<ul>
					<li>Server: ${os.hostname()}</li>
					<li>Date: ${new Date()}</li>
					<li>Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
					<li>Cached result seasons: ${season.cached}</li>
					<li>Response time seasons: ${season.execTime}</li>
					<li>Cached result people: ${people.cached}</li>
					<li>Response time people: ${people.execTime}</li>
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
						valueAxis.min = -9000;
						valueAxis.max = 7000;
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

	
	Promise.all([getPeopleOfSeason(season)]).then(values => {
		const personOfSeason = values[0]

		const peopleHtml = personOfSeason.result
		.map(p => `<li class="collection-item"> ${p.name}</li>`)
		.join("\n")

		const peopleChart = personOfSeason.result
				.map(p =>  {

					let person = {
						category: p.name,
						negative1: (Math.floor((Math.random() * 4500) + 1))*(-1),
						negative2: (Math.floor((Math.random() * 4500) + 1))*(-1),
						positive1: (Math.floor((Math.random() * 3000) + 1)),
						positive2: (Math.floor((Math.random() * 3000) + 1))
					}
					return person
				})

		console.log(JSON.stringify(peopleChart))
		const html =`			
				<header>
					<div class="navbar-fixed">
					<nav>
						<div class="nav-wrapper brown darken-4">
							<a href="#" class="brand-logo">GoT</a>
						</div>
					</nav>
					</div>
				</header>
			
				<main>
				<div class="row" id="person">
				<div class="col s2">
					<ul class="collection with-header">
						<li class="collection-header"><h4>Personen in Staffel ${season}</h4></li>
						${peopleHtml}
					</ul>
				</div>
				<div class="col s10">
					<!--<h1>Anzahl Sätze von John je Staffel nach Sentimentgruppen</h1>
					<div id="heatmap"></div>-->
	
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
					<li>Cached result: ${personOfSeason.cached}</li>
					<li>Response time result: ${personOfSeason.execTime}</li>
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
					valueAxis.min = -9000;
					valueAxis.max = 7000;
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

	Promise.all([getPerson(person)]).then(values => {
		const personData = values[0]

		const html =`			
				<header>
					<div class="navbar-fixed">
					<nav>
						<div class="nav-wrapper brown darken-4">
							<a href="#" class="brand-logo">GoT</a>
						</div>
					</nav>
					</div>
				</header>
			
				<main>
					<div class="row" id="staticData">
						<div class="col s3">
							<h4>${person}</h4>
							<table>
								<tbody>
									<tr>
										<td>Anzahl Sätze</td>
										<td>${personData.countSentence}</td>
									</tr>
									<tr>
										<td>Anzahl teilgenommener Staffeln</td>
										<td>${personData.countSeasons}</td>
									</tr>
								</tbody>
							</table>
					  	</div>
						<div class="col s9">
						<h1>Anzahl Sätze von ${person} je Staffel nach Sentimentgruppen</h1>
						<div id="heatmap"></div>
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
					<li>Cached result: ${personData.cached}</li>
					<li>Response time result: ${personData.execTime}</li>
				</ul>
				</footer>
				<script>
					// heatmap
					function createChart(){
						var chart = am4core.create("heatmap", am4charts.XYChart);
						chart.maskBullets = false;
						
						var xAxis = chart.xAxes.push(new am4charts.CategoryAxis());
						var yAxis = chart.yAxes.push(new am4charts.CategoryAxis());
						
						xAxis.dataFields.category = "sentiment";
						yAxis.dataFields.category = "season";
						
						xAxis.renderer.grid.template.disabled = true;
						xAxis.renderer.minGridDistance = 40;
						
						yAxis.renderer.grid.template.disabled = true;
						yAxis.renderer.inversed = true;
						yAxis.renderer.minGridDistance = 30;
						
						var series = chart.series.push(new am4charts.ColumnSeries());
						series.dataFields.categoryX = "sentiment";
						series.dataFields.categoryY = "season";
						series.dataFields.value = "value";
						series.sequencedInterpolation = true;
						series.defaultState.transitionDuration = 3000;
						
						var bgColor = new am4core.InterfaceColorSet().getFor("background");
						
						var columnTemplate = series.columns.template;
						columnTemplate.strokeWidth = 1;
						columnTemplate.strokeOpacity = 0.2;
						columnTemplate.stroke = bgColor;
						columnTemplate.tooltipText = "{sentiment}, {season}: {value.workingValue.formatNumber('#.')}";
						columnTemplate.width = am4core.percent(100);
						columnTemplate.height = am4core.percent(100);
						
						series.heatRules.push({
						target: columnTemplate,
						property: "fill",
						min: am4core.color(bgColor),
						max: chart.colors.getIndex(0)
						});
						
						// heat legend
						var heatLegend = chart.bottomAxesContainer.createChild(am4charts.HeatLegend);
						heatLegend.width = am4core.percent(100);
						heatLegend.series = series;
						heatLegend.valueAxis.renderer.labels.template.fontSize = 9;
						heatLegend.valueAxis.renderer.minGridDistance = 30;
						
						// heat legend behavior
						series.columns.template.events.on("over", function(event) {
						handleHover(event.target);
						})
						
						series.columns.template.events.on("hit", function(event) {
						handleHover(event.target);
						})
						
						function handleHover(column) {
						if (!isNaN(column.dataItem.value)) {
							heatLegend.valueAxis.showTooltipAt(column.dataItem.value)
						}
						else {
							heatLegend.valueAxis.hideTooltip();
						}
						}
						
						series.columns.template.events.on("out", function(event) {
						heatLegend.valueAxis.hideTooltip();
						})
						
						chart.data = [
						{
							"season": "season 1",
							"sentiment": "-5",
							"value": 2990
						},
						{
							"season": "season 2",
							"sentiment": "-5",
							"value": 2520
						},
						{
							"season": "season 3",
							"sentiment": "-5",
							"value": 2334
						},
						{
							"season": "season 4",
							"sentiment": "-5",
							"value": 2230
						},
						{
							"season": "season 5",
							"sentiment": "-5",
							"value": 2325
						},
						{
							"season": "season 6",
							"sentiment": "-5",
							"value": 2019
						},
					
						{
							"season": "season 1",
							"sentiment": "0",
							"value": 3346
						},
						{
							"season": "season 2",
							"sentiment": "0",
							"value": 2725
						},
						{
							"season": "season 3",
							"sentiment": "0",
							"value": 3052
						},
						{
							"season": "season 4",
							"sentiment": "0",
							"value": 3876
						},
						{
							"season": "season 5",
							"sentiment": "0",
							"value": 4453
						},
						{
							"season": "season 6",
							"sentiment": "0",
							"value": 3972
						},
						{
							"season": "season 1",
							"sentiment": "+5",
							"value": 4468
						},
						{
							"season": "season 2",
							"sentiment": "+5",
							"value": 3306
						},
						{
							"season": "season 3",
							"sentiment": "+5",
							"value": 3906
						},
						{
							"season": "season 4",
							"sentiment": "+5",
							"value": 4413
						},
						{
							"season": "season 5",
							"sentiment": "+5",
							"value": 4726
						},
						{
							"season": "season 6",
							"sentiment": "+5",
							"value": 4584
						},
						];
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
