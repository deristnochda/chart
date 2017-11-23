class Chart {
  constructor(data, type, where, size, margins, legend) {
    this.data = data;
    this.type = type;
    this.size  = size
    this.margins = margins
    
    this.createBase(where, legend);
    this.initAxis();
    this.scaleXAxis();
    this.addXAxis();
    this.scaleYAxis();
    this.addYAxis();
    var x = this.x;
    var y = this.y;
    
    this.initColor();
    this.measure = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.price); });
    
    this.plotLines();
    if (legend){
      this.addLegend();
    }
    
  }
  // create svg
  createBase(where, legend) {
    var svgWidth = this.size.width + this.margins.left + this.margins.right,
        svgHeight = this.size.height + this.margins.top + this.margins.bottom,
        translateLeft = this.margins.left,
        translateTop = this.margins.top;
    
    if (legend) {
      svgHeight += 50;
      translateTop += 50;
    }
    this.svg = where.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
    this.baseLayer = this.svg.append("g")
         .attr("transform", "translate(" + translateLeft + "," + translateTop + ")");
    if (legend) {
      this.legendLayer = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", "translate(" + translateLeft + "," + (translateTop - 50) + ")");
    } else {
      this.legendLayer = null;
    }
  }
  // axis setup
  initAxis() {
    this.x = d3.scaleTime().range([0, this.size.width]);
    this.y = d3.scaleLinear().range([this.size.height, 0]);
  }
  scaleXAxis() {
    var minimum = d3.min(this.data, function(d) { return d3.min(d.values, function(v) { return v.date; }); });
    var maximum = d3.max(this.data, function(d) { return d3.max(d.values, function(v) { return v.date; }); });
    this.x.domain([minimum, maximum]);
  }
  scaleYAxis() {
    this.y.domain([0, d3.max(this.data, function(d) { return d3.max(d.values, function(v) { return v.price; }); })]);
  }
  addXAxis() {
    this.baseLayer.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + this.size.height + ")")
      .call(d3.axisBottom(this.x));
  }
  addYAxis() {
    this.baseLayer.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(this.y));
  }
  // color scheme
  initColor() {
    this.color = d3.scaleOrdinal(d3.schemeCategory10);
  }
  // make the plot
  plotLines() {
    var measure = this.measure;
    var color = this.color;
    this.lines = this.baseLayer.selectAll(".line").data(this.data);
    this.lines.enter().append("path")
      .attr("class", "line")
      .attr("d", function(d) { return measure(d.values); })
      .attr("stroke", function(d) { return color(d.key); });
    this.lines.exit().remove();
  }
  // add legend
  addLegend() {
    var color = this.color,
        lines = this.baseLayer.selectAll(".line");
    // add each legend item
    var legendItems = this.legendLayer.selectAll(".legend-item").data(this.data.reverse())
        .enter().append("g")
          .attr("class", "legend-item")
          .on("click", function(d) {
            var opacity = d3.select(this).classed("legend-item-disabled") ? 1 : 0,
                legendOpacity = d3.select(this).classed("legend-item-disabled") ? false : true;
            lines.filter(function(u) {
              return u.key == d.key;
            }).transition().duration(500).style("stroke-opacity", opacity);
            d3.select(this).classed("legend-item-disabled", legendOpacity)
          })
    // for each legend item make a rectangle in corresponding color
    legendItems.append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", function(d) { return color(d.key); });
    // add the legend items description text
    legendItems.append("text")
      .attr("x", 22)
      .attr("y", 14)
      .text(function(d) { return d.key; });
    // variable used for right aligning the items 
    var rightEnd = this.size.width;
    legendItems.each(function(d) {
      var item = d3.select(this);
      rightEnd = rightEnd - item.select("text").node().getBBox().width - 26;
      item.attr("transform", "translate(" + rightEnd + ", 0)");
    })
  }
  

}