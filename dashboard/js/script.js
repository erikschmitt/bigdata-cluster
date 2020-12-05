// am4core
am4core.ready(function() {



  // Themes begin
  am4core.useTheme(am4themes_animated);
  // Themes end
  
//######################################################################
/*
  // heatmap
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
  

//######################################################################



// Create chart instance
var chart2 = am4core.create("stackedbars", am4charts.XYChart);

// Title
var title = chart2.titles.push(new am4core.Label());
title.text = "Anzahl Sätze von Personen gruppiert in Sentimentgruppen";
title.fontSize = 25;
title.marginBottom = 15;

// Add data
chart2.data = [{
"category": "john",
"negative1": -1000,
"negative2": -3000,
"positive1": 5000,
"positive2": 1000
}, {
"category": "ned",
"negative1": -3000,
"negative2": -1000,
"positive1": 4000,
"positive2": 500
}, {
"category": "jaime",
"negative1": -3000,
"negative2": -5000,
"positive1": 2000,
"positive2": 200
}, {
"category": "cersei",
"negative1": -4500,
"negative2": -3500,
"positive1": 200,
"positive2": 50
}];


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


//######################################################################


//Hybrid drill-down Pie/Bar chart

// Source data

var data = [{
"category": "john",
"value": 10000,
"color": am4core.color("#dc4534"),
"breakdown": [{
  "category": "eher negativ",
  "value": 1000
}, {
  "category": "negativ",
  "value": 3000
}, {
  "category": "eher positiv",
  "value": 5000
}, {
  "category": "positiv",
  "value": 1000
}]
}, {
"category": "ned",
"value": 8500,
"color": am4core.color("#d7a700"),
"breakdown": [{
  "category": "eher negativ",
  "value": 3000
}, {
  "category": "negativ",
  "value": 1000
}, {
  "category": "eher positiv",
  "value": 4000
}, {
  "category": "positiv",
  "value": 500
}]
}, {
"category": "jaime",
"value": 10200,
"color": am4core.color("#68ad5c"),
"breakdown": [{
  "category": "eher negativ",
  "value": 3000
}, {
  "category": "negativ",
  "value": 5000
}, {
  "category": "eher positiv",
  "value": 2000
}, {
  "category": "positiv",
  "value": 200
}]
}]

// Chart container


// Create chart instance
var chart3 = am4core.create("hybridpiebar", am4core.Container);
chart3.width = am4core.percent(100);
chart3.height = am4core.percent(100);
chart3.layout = "horizontal";


// Column chart


// Create chart instance
var columnChart = chart3.createChild(am4charts.XYChart);

// Create axes
var categoryAxis = columnChart.yAxes.push(new am4charts.CategoryAxis());
categoryAxis.dataFields.category = "category";
categoryAxis.renderer.grid.template.location = 0;
categoryAxis.renderer.inversed = true;

var valueAxis = columnChart.xAxes.push(new am4charts.ValueAxis());

// Create series
var columnSeries = columnChart.series.push(new am4charts.ColumnSeries());
columnSeries.dataFields.valueX = "value";
columnSeries.dataFields.categoryY = "category";
columnSeries.columns.template.strokeWidth = 0;

// Pie chart


// Create chart instance
var pieChart = chart3.createChild(am4charts.PieChart);
pieChart.data = data;
pieChart.innerRadius = am4core.percent(50);

// Add and configure Series
var pieSeries = pieChart.series.push(new am4charts.PieSeries());
pieSeries.dataFields.value = "value";
pieSeries.dataFields.category = "category";
pieSeries.slices.template.propertyFields.fill = "color";
pieSeries.labels.template.disabled = true;

// Set up labels
var label1 = pieChart.seriesContainer.createChild(am4core.Label);
label1.text = "";
label1.horizontalCenter = "middle";
label1.fontSize = 35;
label1.fontWeight = 600;
label1.dy = -30;

var label2 = pieChart.seriesContainer.createChild(am4core.Label);
label2.text = "";
label2.horizontalCenter = "middle";
label2.fontSize = 12;
label2.dy = 20;

// Auto-select first slice on load
pieChart.events.on("ready", function(ev) {
pieSeries.slices.getIndex(0).isActive = true;
});

// Set up toggling events
pieSeries.slices.template.events.on("toggled", function(ev) {
if (ev.target.isActive) {
  
  // Untoggle other slices
  pieSeries.slices.each(function(slice) {
    if (slice != ev.target) {
      slice.isActive = false;
    }
  });
  
  // Update column chart
  columnSeries.appeared = false;
  columnChart.data = ev.target.dataItem.dataContext.breakdown;
  columnSeries.fill = ev.target.fill;
  columnSeries.reinit();
  
  // Update labels
  label1.text = pieChart.numberFormatter.format(ev.target.dataItem.values.value.percent, "#.'%'");
  label1.fill = ev.target.fill;
  
  label2.text = ev.target.dataItem.category;
}
});
*/
createChart();
  }); // end am4core.ready()