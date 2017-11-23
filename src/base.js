"use strict"

class Chart {
  constructor(data, where) {
    // standard config values
    this.size = {width: 600, height: 400};
    this.margin = {top: 10, right: 10, bottom: 30, left: 30};
    this.legend.exists = false;
    this.legend.height = 0;
    
    // make the svg
    this.svg = where.append("svg");
    // make the base layer for the chart
    this.baseLayer = this.svg.append("g");
    this.baseLayer.size = {width: this.size.width - this.margin.left - this.margin.right,
                           height: this.size.height - this.margin.top - this.margin.bottom - this.legend.height};
    //
    this.data = data;
    this.addAxes();
    this.resize();
  }
  
  // getter/setter for width and height of svg
  width(value) {
    if(!arguments.length) return this.size.width;
    this.size.width = value;
    this.resize();
    return this;
  }
  height(value) {
    if(!arguments.length) return this.size.height;
    this.size.height = value;
    this.resize();
    return this;
  }
  
  resize() {
    // svg
    this.svg.attr("width", this.size.width)
            .attr("height", this.size.height);
    // base layer
    this.baseLayer.attr("transform", "translate(" + this.margin.left + ',' + (this.margin.top + this.legend.height) + ")");
    this.baseLayer.size = {width: this.size.width - this.margin.left - this.margin.right,
                           height: this.size.height - this.margin.top - this.margin.bottom - this.legend.height};
    // legend layer
    if(this.legend.exists) {
      this.legendLayer.attr("transform", "translate(" + this.margin.left + ',' + this.margin.top + ")");
    }
    this.axes.x.axis.range([0, this.baseLayer.size.width]);
    this.axes.y.axis.range([this.baseLayer.size.height, 0]);
  }
  
  legend(bool=true) {
    if(bool){
      if(!this.legend.exists) {
        this.legend.exists = true;
        this.legend.height = 50;
        this.legendLayer = this.svg.append("g").attr("class", "legend");
        this.resize();
      }
    } else {
      if (this.legend.exists) {
        this.legend.exists = false;
        this.legend.height = 0;
        this.legendLayer.remove();
        delete this.legendLayer;
        this.resize();
      }
    }
    return this;
  }
  
  addAxes() {
    this.axes = {x: new Axis(this.baseLayer, "time", "bottom", this.baseLayer.size),
                 y: new Axis(this.baseLayer, "linear", "left", this.baseLayer.size)};
    var minimum = d3.min(this.data, function(d) { return d3.min(d.values, function(v) { return v.date; }); });
    var maximum = d3.max(this.data, function(d) { return d3.max(d.values, function(v) { return v.date; }); });
    this.axes.x.rescale(minimum, maximum);
    this.axes.y.rescale(0, 200);
  }
}

class Axis {
  constructor(where, scale, pos, size) {
    // initialize the axis object
    var range = [],
        offset = 0;
    if(pos=="top"){
      range = [0, size.width];
      offset = 0;
    }
    if(pos=="bottom") {
      range = [0, size.width];
      offset = size.height;
    }
    if(pos=="left") {
      range = [size.height, 0];
      offset = 0;
    }
    if(pos=="right") {
      range = [size.height, 0];
      offset = size.width;
    }
    console.log(range);
    if(scale=="time") {
      this.axis = d3.scaleTime().range(range);
    } else {
      this.axis = d3.scaleLinear().range(range);
    }
    this.drawAxis(where, pos, offset);
  }
  // rescale the axis to domain [minimum, maximum]
  rescale(minimum, maximum) {
    this.axis.domain([minimum, maximum]);
    return this;
  }
  /*
    add the axis object to the chart
    where: a valid d3.selection
    pos: in ["top", "right", "bottom", "left"]
  */
  drawAxis(where, pos, offset) {
    this.axisDrawn = where.append("g")
      .attr("class", "axis");
    if(pos=="top") {
      this.update = (function(offset) { this.axisDrawn.call(d3.axisTop(this.axis)); return this; });
    }
    if(pos=="right") {
      this.update = (function(offset) { this.axisDrawn.call(d3.axisRight(this.axis)); return this; });
    }
    if(pos=="bottom") {
      this.axisDrawn
        .attr("transform", "translate(0,"+ offset + ")")
        .call(d3.axisBottom(this.axis));
    }
    if(pos=="left") {
      this.update = (function(offset) { this.axisDrawn.call(d3.axisTop(this.axis)); return this; });
    }
    return this;
  }
}