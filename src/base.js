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
    // bind data to chart
    this.data = data;
    this.addAxes();
    this.resize();
  }

  // getter/setter for width and height of svg
  width(value) {
    if (!arguments.length) return this.size.width;
    this.size.width = value;
    this.resize();
    return this;
  }
  height(value) {
    if (!arguments.length) return this.size.height;
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
    if (this.legend.exists) {
      this.legendLayer.attr("transform", "translate(" + this.margin.left + ',' + this.margin.top + ")");
    }
    this.axes.x.update(this.baseLayer.size, this.calculateDomain("date"));
    this.axes.y.update(this.baseLayer.size, this.calculateDomain("price"));
  }

  legend(bool=true) {
    if (bool){
      if (!this.legend.exists) {
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

  /*
    method for calculation the domain of the chart
  */
  calculateDomain(varName) {
    var minimum = d3.min(this.data, function(d) {
      return d3.min(d.values, function(v) { return v[varName]; });
    });
    var maximum = d3.max(this.data, function(d) {
      return d3.max(d.values, function(v) { return v[varName]; });
    })
    return [minimum, maximum];
  }

  addAxes() {
    this.axes = {x: new Axis(this.baseLayer, "time", "bottom", this.baseLayer.size, this.calculateDomain("date")),
                 y: new Axis(this.baseLayer, "linear", "left", this.baseLayer.size, this.calculateDomain("price"))};
  }
}

class Axis {
  constructor(where, scale, pos, size, domain) {
    if (scale=="time") {
      this.axis = d3.scaleTime();
    } else {
      this.axis = d3.scaleLinear();
    }
    this.position = pos;
    this.draw(where);

    this.update(size, domain);
  }
  /*
    calculate all positioning relevant data
    needs:
      size: size object of the layer {width, height},
    returns:
      range: array [min, max],
      offset: string for transform attribute.
  */
  calculatePositions(size) {
    var range = [],
        offset = "translate(0,0)";
    if (this.position=="top"){
      range = [0, size.width];
    } else if (this.position=="bottom") {
      range = [0, size.width];
      offset = "translate(0," + size.height + ")";
    } else if (this.position=="left") {
      range = [size.height, 0];
    } else if (this.position=="right") {
      range = [size.height, 0];
      offset = "translate(" + size.width + ",0)";
    }
    return [range, offset];
  }
  /*
    add the axis object to the chart
    where: a valid d3.selection
    pos: in ["top", "right", "bottom", "left"]
  */
  draw(where) {
    this.axisDrawn = where.append("g")
      .attr("class", "axis");
    if (this.position=="top") {
      this.axisPositioning = d3.axisTop;
    } else if (this.position=="right") {
      this.axisPositioning = d3.axisRight;
    } else if (this.position=="bottom") {
      this.axisPositioning = d3.axisBottom;
    } else if (this.position=="left") {
      this.axisPositioning = d3.axisLeft;
    }
    return this;
  }
  /*
    updates the axis object
  */
  update(size, domain) {
    // positioning and size
    var [range, offset] = this.calculatePositions(size);
    this.axis.range(range);
    this.axisDrawn
        .attr("transform", offset)
        .call(this.axisPositioning(this.axis));
    // update the domain
    this.axis.domain(domain);
    return this;
  }
}
