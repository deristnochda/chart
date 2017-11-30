"use strict"

class Chart {
  constructor(data, where) {
    // standard config values
    this.size = {width: 600, height: 400};
    this.margin = {top: 10, right: 10, bottom: 30, left: 30};
    // make the svg
    this.svg = where.append("svg");
    // initialize legend
    this.legend.exists = false;
    this.legend.height = 0;

    // make the base layer for the chart
    this.baseLayer = this.svg.append("g");
    this.baseLayer.size = {width: this.size.width - this.margin.left - this.margin.right,
                           height: this.size.height - this.margin.top - this.margin.bottom - this.legend.height};
    // bind data to chart
    this.data = data;
    this.data.forEach(function(d) { d.show = true; return d; });
    this.addAxes();
    // plot lines
    this.lines = new Line(this.data, this.baseLayer, this.axes.x.axis, this.axes.y.axis);

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
    this.lines.draw(this.data);
  }

  legend(bool=true) {
    if (bool){
      if (!this.legend.exists) {
        this.legend.exists = true;
        this.legend.height = 50;
        this.legendLayer = this.svg.append("g").attr("class", "legend");
        this.addLegendEntries();
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

  addLegendEntries() {
    var color = this.lines.color,
        lines = this.baseLayer.selectAll(".line"),
        self = this;
    // add each legend item
    var legendItems = this.legendLayer.selectAll(".legend-item")
      .data(this.data)
        .enter().append("g")
          .attr("class", "legend-item")
          .classed("legend-item-disabled", function(d) { return !d.show; })
          .on("click", function(d) {
            var opacity = d3.select(this).classed("legend-item-disabled") ? 1 : 0,
                legendOpacity = d3.select(this).classed("legend-item-disabled") ? false : true;
            lines.filter(function(u) {
              return u.key == d.key;
            }).style("stroke-opacity", opacity);
            d3.select(this).classed("legend-item-disabled", legendOpacity)
            d.show = !legendOpacity;
            self.resize();
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
    var rightEnd = this.size.width - this.margin.left;
    legendItems.each(function(d) {
      var item = d3.select(this);
      rightEnd = rightEnd - item.select("text").node().getBBox().width - 26;
      item.attr("transform", "translate(" + rightEnd + ", 0)");
    })
  }
  /*
    method for calculation the domain of the chart
  */
  calculateDomain(varName) {
    var minimum = d3.min(this.data.filter( function(d) { return d.show==true; }),
      function(d) {
        return d3.min(d.values, function(v) { return v[varName]; });
      });
    var maximum = d3.max(this.data.filter( function(d) { return d.show==true; }),
      function(d) {
        return d3.max(d.values, function(v) { return v[varName]; });
      });
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

class Line {
  constructor(data, where, x, y) {
    this.where = where;
    this.x = x;
    this.y = y;
    this.color = d3.scaleOrdinal(d3.schemeCategory10);
    this.measure = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.price); });
    this.draw(data);
  }

  draw(data) {
    var measure = this.measure,
        color = this.color;
    this.lines = this.where.selectAll(".line").data(data);
    this.lines.enter().append("path")
      .attr("class", "line")
      .merge(this.lines)
        .attr("d", function(d) { return measure(d.values); })
        .attr("stroke", function(d) { return color(d.key); });
    this.lines.exit().remove();
  }
}
