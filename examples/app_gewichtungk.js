//-----------------------------------------------------------------------------
// Farbkonvertierung
//-----------------------------------------------------------------------------
// convert a hexidecimal color string to 0..255 R,G,B
hexToRGB = function(hex) {
  hex = parseInt(hex.substr(1), 16);
  var r = hex >> 16;
  var g = hex >> 8 & 0xFF;
  var b = hex & 0xFF;
  return [r,g,b];
}
// convert 0..255 R,G,B values to a hexidecimal color string
RGBToHex = function([r,g,b]) {
  var bin = r << 16 | g << 8 | b;
  return "#" + (function(h){
      return new Array(7-h.length).join("0")+h
  })(bin.toString(16).toUpperCase())
}
// Overlay mit Schwarz (Transparenz 1-alpha)
blackOverlay = function(hex, alpha) {
  [r, g, b] = hexToRGB(hex);
  return RGBToHex([alpha*r, alpha*g, alpha*b]);
}
//-----------------------------------------------------------------------------
// Funktionen für die Kartendarstellung
//-----------------------------------------------------------------------------
// globale Definitionen
var geojson = topojson.feature(topo, topo.objects.Zulassungsbezirke);
var projection = d3.geoMercator().fitSize([500, 500], geojson);
var path = d3.geoPath().projection(projection);
var color_schemes = {je: ["#EDF8F6", "#CFECE4", "#B1E0D2", "#93D4C0", "#75C8AE", "#66C2A5", "#529C83", "#3E7661", "#2A503F"],
                     ant: ["#EDF8F6", "#CFECE4", "#B1E0D2", "#93D4C0", "#75C8AE", "#66C2A5", "#529C83", "#3E7661", "#2A503F"],
                     gsb: ["#F7EBF0", "#EBBBC8", "#DF8BA0", "#D35B78", "#C72B50", "#C1133C", "#9B0F30", "#750B24", "#4F0718"],
                     sb: ["#EDF7F7", "#C7DFED", "#A1C7E3", "#7BAFD9", "#5597CF", "#428BCA", "#346FA2", "#26537A", "#183752"],
                     diff: ["#750B24", "#C1133C", "#D35B78", "#EBBBC8", "#FFFFFF", "#C7DFED", "#7BAFD9", "#428BCA", "#26537A"]};
// Zoom-Funktionalität
var zoom = d3.zoom()
  .scaleExtent([1, 5])
  .on("zoom", zoomed);
var zoom_level = 1;

// Funktion für Zoom
function zoomed() {
  var g = map.select(".content_layer")
  zoom_level = d3.event.transform.k || zoom_level;
  g.selectAll("path").style("stroke-width", 0.5 / zoom_level + "px");
  g.attr("transform", d3.event.transform);
}

// Funktion für ClickToZoom
function zoomToFeature(zbn) {
  var sel = map.selectAll("path")
    .filter(function(e) { return e.properties.zbn==zbn; });
  d = sel.data()[0];
  if(!sel.filter(".highlighted").empty()) sel = sel.filter(".highlighted");
  var row = map_data.selectAll(".panel")
    .filter(function(e) { return e.properties.zbn==zbn; });
  // herauszoomen falls bereits hineingezoomt
  if(sel.classed("highlighted")) return reset();
  // entferne die Markierungen
  map.selectAll(".highlighted").remove();
  map_data.selectAll(".panel-primary")
    .attr("class", "panel panel-default");
  // neue Markierung
  row.attr("class", "panel panel-primary");
  sel = map.select(".content_layer").append("path")
    .datum(d)
    .attr("d", path)
    .attr("class", "highlighted")
    .style("fill-opacity", 0.7)
    .on("click", reset)
    .on("mouseenter", function() { d3.select(this).style("fill-opacity", 0.85); })
    .on("mouseleave", function() { d3.select(this).style("fill-opacity", 0.7); })
    .append("svg:title")
      .text(function(d) { return d.properties.zb_name; });
  // Berechne Mittelpunkt des Zulassungsbezirke
  var bounds = path.bounds(d),
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    translate = [map_width / 2 - 5 * x, map_height / 2 - 5 * y];
  // hereinzoomen
  map.transition().duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(5));
  // scrolle zum Tabelleneintrag
  var main = d3.select("#zb_list");
  var obj = main.node();
  main.transition()
    .duration(750)
    .tween("scroll", scrollTopTween(- obj.getBoundingClientRect().top + row.node().getBoundingClientRect().top, obj));
}

function scrollTopTween(scrollTop, obj) {
  return function() {
    var i = d3.interpolateNumber(obj.scrollTop, obj.scrollTop + scrollTop);
    return function(t) { obj.scrollTop = i(t); };
  };
}

// Funktion zum Reset der Darstellung
function reset() {
  map.selectAll(".highlighted").remove();
  map_data.selectAll(".panel-primary")
    .attr("class", "panel panel-default");
  // scrolle Tabelle nach oben
  d3.select("#zb_list").property("scrollTop", 0);
  // herauszoomen
  map.transition().duration(750)
    .call(zoom.transform, d3.zoomIdentity);
}

// Verhindert Klick beim Ziehen der Karte
function stopped() {
  if(d3.event.defaultPrevented) d3.event.stopPropagation();
}

// Mouseover Effekt
function highlightFeature(d) {
  d3.select(this)
    .style("fill", blackOverlay(d.properties.color, 0.6));
}
// entferne Mouseover Effekt
function deHighlightFeature(d) {
  d3.select(this)
    .style("fill", d.properties.color);
}

// Funktion zeichnet Karte
function drawMap(data, which_var, threshold) {
  // passende d3-Selektion
  var g = map.select(".content_layer");
  // Abbildung der Daten data auf die Nummer der Zulassungbezirke
  var map_values = d3.map();
  data.forEach(function(d) {
    map_values.set(d.auspr, {je: d.je, gsb: d.gsb, sb: d.sb, markt_je: d.markt_je});
  });
  // Daten an Shapes anspielen
  var data_geojson = geojson.features.map(function(d) {
    var val = map_values.get(d.properties.zbn) || {je: 0, gsb: 0, sb: 0, markt_je: 0};
    d.properties.je = val.je;
    d.properties.ant = Math.round(val.je / Math.max(val.markt_je, 1) * 10000)/100;
    d.properties.gsb = val.gsb;
    d.properties.sb = val.sb;
    d.properties.diff = val.sb - val.gsb;
    return d;
  });
  // berechne Definitionsbereich
  var data_filter = data_geojson.filter(function(d) { return d.properties.je>threshold; });
  var min_value = d3.min(data_filter, function(d) { return d.properties[which_var]; });
  var max_value = d3.max(data_filter, function(d) { return d.properties[which_var]; });
  var range_value = max_value - min_value;
  var choropleth_values = d3.range(8).map(function(d) { return min_value + (d+1)/9*range_value; });
  // Farbgebung
  var color_values = color_schemes[which_var];
  // Farbskala
  var color = d3.scaleThreshold()
    .domain(choropleth_values)
    .range(color_values);
  var zb = g.selectAll("path")
    .data(data_geojson, function(d) { return d.properties.zbn; });
  var enter = zb.enter().append("path")
    .attr("d", path)
    .attr("class", "feature")
    .on("click", function(d) { zoomToFeature(d.properties.zbn); })
    .on("mouseenter", highlightFeature)
    .on("mouseleave", deHighlightFeature)
  enter.append("svg:title")
    .text(function(d) { return d.properties.zb_name; });
  enter.merge(zb)
      .style("fill", function(d) { d.properties.color = color(d.properties[which_var]);return d.properties.color; });
  // Erzeuge Choropleth-Skala
  map_legend.selectAll("rect")
    .data(color.range())
      .style("fill", function(d) { return d; });
  var x = d3.scaleLinear()
    .domain([min_value, max_value])
    .range([map_height, 0]);
  var xAxis = d3.axisRight(x)
    .tickValues(choropleth_values)
    .tickSize(25);
  map_legend.call(xAxis)
    .select(".domain").remove();
  // sortiere zugehörige tabellarische Darstellung
  map_data.selectAll("div.panel").data(data_geojson, function(d) { return d.properties.zbn; })
    .sort(function(a, b) { return b.properties[which_var] - a.properties[which_var]; })
    .select("div.panel-body")
      .html(function(d) { return "Jahreseinheiten: " + d.properties.je + " | Marktanteil in %: " + d.properties.ant + "<br>Gew. SB: " + d.properties.gsb + " | SB: " + d.properties.sb; });
}

// Wrapper zum neu zeichnen mit anderen Daten
function redrawMap() {
  var threshold = d3.select("#map_range").property("value");
  var which_var = d3.select("input[name=map_radio]:checked").property("value");
  var which_data = d3.select("#map_submenu").selectAll("li").filter(".active").data()[0];
  var filtered = results.filter(function(d) { return d.merkmal=="zbn" & d.ausgl_gr==which_data; });
  d3.select("#lbl_map_range").text("Farbskala kalibriert anhand der Zulassungsbezirke mit mehr als "+ threshold + " Jahreseinheiten.");
  drawMap(filtered, which_var, threshold);
  reset();
}

// Wrapper zum neu zeichnen mit anderem Threshold






// Funktion generiert Tabelleninhalte
function drawTable(data, ausgl_gr, merkmal) {
  if ( data.length==2 ) {
    data = data.filter(function(d) { return d.merkmal!="gesamt"; } );
  }
  // selektiere Tabellenobjekt
  var tbody = d3.selectAll("table")
    .filter(function(d) { return d.ausgl_gr==ausgl_gr & d.merkmal==merkmal; })
    .select("tbody");
  // Erzeuge Zeilen
  var rows = tbody.selectAll("tr").data(data, function(d) { return d.auspr; });
  rows.exit().remove();
  rows = rows.enter().append("tr")
    .on("mouseover", function(d) { addHighlight(d); })
    .on("mouseout", function(d) { removeHighlight(d); })
    .merge(rows);
  // Erzeuge Tabellenzelle für jede Spalte
  var cells = rows.selectAll("td")
    .data(function(row) {
      return columns.map(function(c) {
        return {col: c.id, value: row[c.id], diff: row.gsb-row.sb, sz: (row.merkmal=="gesamt")};
      });
    }).enter().append("td")
    .attr("class", function(d) {
      if(d.col=="auspr") {
        if(d.diff>0) return "diffp";
        else return "diffn";
      }else return "";
    }).html(function(d) { 
      if(d.col=="auspr" & d.sz) return "Gesamt";
      else return d.value;
    });
}


// Funktion malt das Balkendiagramm
function drawBarchart(data, ausgl_gr, merkmal) {
  if(je_display=="verteilung") {
    if(data.length==2) {
      data = data.filter(function(d) { return d.merkmal!="gesamt"; } );
    } else {
      var gesamt = data.filter(function(d) { return d.merkmal=="gesamt"; } )[0].je;
      data = data.map(function(d) {
        if(d.merkmal=="gesamt"){
          return {
            ausgl_gr:d.ausgl_gr,
            auspr:d.auspr,
            merkmal:d.merkmal,
            gsb:d.gsb,
            sb:d.sb,
            je:0
          };
        } else {
          return {
            ausgl_gr:d.ausgl_gr,
            auspr:d.auspr,
            merkmal:d.merkmal,
            gsb:d.gsb,
            sb:d.sb,
            je:d.je/gesamt
          };
        }
      });
    }
  } else {
    if(data.length==2) {
        data = data.filter(function(d) { return d.merkmal!="gesamt"; } );
    }
    data = data.map(function(d) {
      return {
        ausgl_gr:d.ausgl_gr,
        auspr:d.auspr,
        merkmal:d.merkmal,
        gsb:d.gsb,
        sb:d.sb,
        je:d.je/d.markt_je
      };
    });
  }
  // selektiere SVG-Objekt
  var svg = d3.selectAll("svg")
      .filter(function(d) { return d.ausgl_gr==ausgl_gr & d.merkmal==merkmal; });
   // Definitions- und Wertebereiche
  var mm_domain = d3.nest()
      .key(function(d) { return d.auspr; })
      .map(data).keys();
  var mm_range = [...Array(mm_domain.length).keys()].map(x => barWidth * (x+0.5));
  
  var sb_domain = [-d3.max(data, function(d) { return d.gsb; }), d3.max(data, function(d) { return d.sb; })];
  var je_domain = [0, d3.max(data.filter(function(d) { return ausgl_gr=="gesamt" | d.merkmal!="gesamt"; } ), function(d) { return d.je; })];
  // definiere die Skalen
  var mm = d3.scaleOrdinal()
      .domain(mm_domain)
      .range(mm_range);
  var sb = d3.scaleLinear()
      .range([0, 0.69*width])
      .domain(sb_domain);
  var je = d3.scaleLinear()
      .range([width, 0.71*width])
      .domain(je_domain);
  // Achse für numerische Werte (horizontal)
  var sbAxis = d3.axisTop(sb);
  svg.select(".sb.axis")
       .call(sbAxis)
       .select(".domain").remove();
  var jeAxis = d3.axisTop(je)
      .ticks(4);
  svg.select(".je.axis")
      .call(jeAxis).select(".domain").remove();

  // füge die Balken hinzu
  svg.attr("height", mm_domain.length * barWidth + margin.top + margin.bottom);
  var layer = svg.select(".content_layer");
  // Balken für Schadenbedarf
  var barsSB = layer.selectAll(".bar.sb")
      .data(data, function(d) { return d.ausgl_gr+d.merkmal+d.auspr; });
  barsSB.exit().remove();
  barsSB.enter().append("rect")
      .attr("class", "bar sb")
      .attr("height", barWidth - 2)
      .on("mouseover", function(d) { addHighlight(d); })
      .on("mouseout", function(d) { removeHighlight(d); })
    .merge(barsSB)
      .attr("x", sb(0))
      .attr("y", function(d) { return mm(d.auspr)-barWidth/2; })
      .attr("width", function(d) { return sb(d.sb) - sb(0); });
  // Balken für gewichteten Schadenbedarf
  var barsGSB = layer.selectAll(".bar.gsb")
      .data(data, function(d) { return d.ausgl_gr+d.merkmal+d.auspr; });
  barsGSB.exit().remove();
  barsGSB.enter().append("rect")
      .attr("class", "bar gsb")
      .attr("height", barWidth - 2)
      .on("mouseover", function(d) { addHighlight(d); })
      .on("mouseout", function(d) { removeHighlight(d); })
    .merge(barsGSB)
      .attr("x", function(d) { return sb(-d.gsb); })
      .attr("y", function(d) { return mm(d.auspr)-barWidth/2; })
      .attr("width", function(d) { return sb(0) - sb(-d.gsb); });
  // Balken für Differenz
  var barsDiff = layer.selectAll(".bar.diff")
      .data(data, function(d) { return d.ausgl_gr+d.merkmal+d.auspr; });
  barsDiff.exit().remove();
  barsDiff.enter().append("rect")
      .attr("class", function(d) { if(d.gsb>d.sb) return "bar diff diffp";else return "bar diff diffn"; })
      .attr("height", barWidth - 2)
      .on("mouseover", function(d) { addHighlight(d); })
      .on("mouseout", function(d) { removeHighlight(d); })
    .merge(barsDiff)
      .attr("x", function(d) { return sb(Math.min(d.sb-d.gsb, 0)); })
      .attr("y", function(d) { return mm(d.auspr)-barWidth/2; })
      .attr("width", function(d) { return sb(-Math.min(d.gsb-d.sb, 0)) - sb(Math.min(d.sb-d.gsb, 0)); });
  // Balken für Jahreseinheiten
  var barsJE = layer.selectAll(".bar.je")
      .data(data, function(d) { return d.ausgl_gr+d.merkmal+d.auspr; });
  barsJE.exit().remove();
  barsJE.enter().append("rect")
      .attr("class", "bar je")
      .attr("height", barWidth - 2)
      .on("mouseover", function(d) { addHighlight(d); })
      .on("mouseout", function(d) { removeHighlight(d); })
    .merge(barsJE)
      .attr("x", function(d) { return je(d.je); })
      .attr("y", function(d) { return mm(d.auspr)-barWidth/2; })
      .attr("width", function(d) { return -je(d.je) + je(0); });
}


function addHighlight(where) {
  d3.selectAll("tr, rect")
    .filter(function(d) { return d.ausgl_gr==where.ausgl_gr & d.merkmal==where.merkmal & d.auspr==where.auspr; })
    .classed("highlighted", true);
}

function removeHighlight(where) {
  d3.selectAll("tr, rect")
    .filter(function(d) { return d.ausgl_gr==where.ausgl_gr & d.merkmal==where.merkmal & d.auspr==where.auspr; })
    .classed("highlighted", false);
}

function applyThreshold(t, pos) {
  je_threshold = t;
  d3.select("#detail_range").text("Zeige Datensätze mit mehr als "+t+" Jahreseinheiten");
  tab_ausglgr.selectAll("table").each(function(d) {
    var filtered = results.filter(function(e) { return e.ausgl_gr==d.ausgl_gr & (e.merkmal==d.merkmal | e.merkmal=="gesamt") & e.je>=t; });
    drawTable(filtered, d.ausgl_gr, d.merkmal);
  });
  tab_ausglgr.selectAll("svg").each(function(d) {
    var filtered = results.filter(function(e) { return e.ausgl_gr==d.ausgl_gr & (e.merkmal==d.merkmal | e.merkmal=="gesamt") & e.je>=t; });
    drawBarchart(filtered, d.ausgl_gr, d.merkmal, je_display);
  });
}

function applyJEDisplayChoice(choice) {
  je_display = choice;
  tab_ausglgr.selectAll("svg").each(function(d) {
    var filtered = results.filter(function(e) { return e.ausgl_gr==d.ausgl_gr & (e.merkmal==d.merkmal | e.merkmal=="gesamt") & e.je>=je_threshold; });
    drawBarchart(filtered, d.ausgl_gr, d.merkmal);
  });
}




// Ränder und Größe des Balkendiagramms
var margin = {top: 37, right: 10, bottom: 0, left: 10},
    width = 600 - margin.left - margin.right,
    barWidth = 37,
    map_height = 500,
    map_width = 500;

var je_threshold = 0;
var je_display = "verteilung";

var categories = [{cat: "gesamt", label: "Gesamtübersicht"},
                  {cat: "zbn", label: "Übersicht nach Zulassungsbezirken"},
                  {cat: "ausglgr", label: "Detailübersicht nach Ausgleichsgruppen"},
                  {cat: "download", label: "Downloads"}];
// Spaltennamen
columns = [{id: "auspr", label: "Auspr"},
           {id: "gsb", label: "Gew. SB"},
           {id: "sb", label: "SB"},
           {id: "je", label: "JE"}];

ausglgr_lbl = {110: "Haftpflicht", 210: "Vollkasko", 310: "Teilkasko"};
merkmal_lbl = {deckung: "Deckung", wstk: "Typklasse", tarif: "Tarif", rkl: "Regionalklasse",
               fahrleistung: "Fahrleistung", diff_na: "Differenziertes Nutzeralter",
               nutzerkreis: "Nutzerkreis", fzalter_erwerb: "Fahrzeugalter bei Erwerb",
               ssf: "Schadenfreiheitsklasse", r_schutz: "Rabattschutz",
               garage: "Garage", wohneigentum: "Wohneigentum", zahlungsperiode: "Zahlungsperiode"};
// showResults wird nachdem die Berechnung ist aufgerufen und rendert alle
// Ergebnisse im Div container_results
function showResults(data) {
  // --------------------------------------------------------------------------------------------
  // Benötigte Daten als Array
  // --------------------------------------------------------------------------------------------
  // Parsen der Daten
  results = d3.csvParse(data, function(d) {
    return {
      flotte:d.flotte,
      sparte:d.sparte,
      ausgl_gr:d.ausgl_gr, 
      merkmal:d.merkmal,
      auspr:d.auspr,
      sb:+d.schadenbedarf,
      gsb:+d.gew_schadenbedarf,
      je:+d.je,
      markt_je:+d.markt_je
    };
  });
  // --------------------------------------------------------------------------------------------
  // Baue Struktur der Seite
  // --------------------------------------------------------------------------------------------
  var container = d3.select("#container_results");
  // --------------------------------------------------------------------------------------------
  // Erzeuge Reitermenü
  var main_menu = container.append("ul").attr("class", "nav nav-tabs")
    .selectAll("li").data(categories)
    .enter().append("li")
      .attr("class", function(d, i) { if (i==0){ return "active";}})
      .append("a")
        .attr("data-toggle", "tab")
        .attr("href", function(d) { return "#"+d.cat; })
        .text(function(d) { return d.label; });
  // --------------------------------------------------------------------------------------------
  // Erzeuge Container für Inhalte
  var main_tabs = container.append("div").attr("class", "tab-content")
    .selectAll("div.tab-pane").data(categories)
    .enter().append("div")
      .attr("class", function(d, i){
        cl = "tab-pane fade";
        if(i==0) cl += " active in";
        return cl;
      })
      .attr("id", function(d) { return d.cat; })
      .append("div").attr("class", "container").datum(function(d) { return d.cat; });
  // --------------------------------------------------------------------------------------------
  // Gesamtübersicht
  // --------------------------------------------------------------------------------------------
  var tab_gesamt = main_tabs.filter(function(d) { return d=="gesamt"; });
  // Array der Ausgleichsgruppen
  ausgl_gr = d3.nest().key(function(d) { return d.ausgl_gr; })
    .entries(results);
  var cards = tab_gesamt.selectAll("div.panel").data(ausgl_gr)
    .enter().append("div")
      .attr("class", "panel panel-default");
  cards.append("div")
    .attr("class", "panel-heading")
    .append("h4")
    .text(function(d){ return ausglgr_lbl[d.key]; });
  // definiere Skala für Schadenbedarfe
  var filtered = results.filter(function(d){ return d.merkmal=="gesamt"; });
  var sb_domain = [0, d3.max(filtered, function(d){ return Math.max(d.sb, d.gsb); })];
  var sb = d3.scaleLinear()
    .range([0, width/2])
    .domain(sb_domain);

  cards.append("div")
    .attr("class", "panel-body")
    .each(function(d){
      var where = d3.select(this).append("div").attr("class", "row");
      // filtern des Ergebnisarrays
      d = filtered.filter(function(e) { return e.ausgl_gr==d.key; })[0];
      // Info Jahreseinheiten
      var je = where.append("div").attr("class", "col-md-3")
      je.append("p")
        .attr("class", "ges-info")
        .style("margin-top", "20px")
        .html('Jahreseinheiten: <span class="lead">'+d.je+'</span>');
      je.append("p")
        .attr("class", "ges-info")
        .html('Marktanteil: <span class="lead je">'+Math.round(d.je/d.markt_je*10000)/100+'%</span>');
      // Info Schadenbedarf
      var table = where.append("div").attr("class", "col-md-4");
      table.append("p")
        .attr("class", "ges-info-ra")
        .style("margin-top", "20px")
        .html('Gewichteter Schadenbedarf: <span class="lead gsb">' + d.gsb + '</span>');
      table.append("p")
        .attr("class", "ges-info-ra")
        .html('Schadenbedarf des VU: <span class="lead sb">' + d.sb + '</span>');

      // Erzeuge SVG
      var svg = where.append("div").attr("class", "col-md-5")
        .append("svg")
          .attr("width", width/2 + margin.left + margin.right)
          .attr("height", 2*(barWidth+2) + 28 + margin.bottom)
          .append("g")
            .attr("class", "content_layer")
            .attr("transform", "translate(" + margin.left + "," + 18 + ")");
      svg.append("g").attr("class", "sb axis");
      var sbAxis = d3.axisTop(sb).ticks(5);
      svg.select(".sb.axis")
        .call(sbAxis)
        .select(".domain").remove();
      // füge die Balken hinzu
      svg.append("rect")
        .attr("class", "bar gsb")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", barWidth)
        .attr("width", sb(d.gsb));
      svg.append("rect")
        .attr("class", "bar sb")
        .attr("x", 0)
        .attr("y", barWidth+2)
        .attr("height", barWidth)
        .attr("width", sb(d.sb));
    });


  // --------------------------------------------------------------------------------------------
  // Übersicht über Zulassungsbezirke
  // --------------------------------------------------------------------------------------------
  var tab = main_tabs.filter(function(d) { return d=="zbn"; });

  // Einstellungsmöglichkeiten
  var setup = tab.append("div").attr("class", "row");

  // Erzeuge Auswahlmenü für Ausgleichsgruppe
  var sub_menu = setup.append("div").attr("class", "col-md-2")
    .append("ul")
      .attr("class", "nav nav-pills nav-stacked")
      .attr("id", "map_submenu");
  sub_menu.selectAll("li").data(["110", "210", "310"])
    .enter().append("li")
      .attr("class", function(d, i) { if (i==0){ return "active";}})
      .append("a")
        .attr("data-toggle", "pill")
        .attr("href", function(d) { return "#map"+d; })
        .on("click", function() {
          d3.select("#map_submenu").selectAll("li").classed("active", false);
          d3.select(this.parentNode).classed("active", true);
          redrawMap();
        })
        .text(function(d) { return ausglgr_lbl[d]; });

  // Formular mit Radios, etc.
  var formular = setup.append("div").attr("class", "col-md-10").append("form");

  // Radio-Button wechselt zwischen Jahreseinheiten, Marktanteil und Schadenbedarf
  var map_radio = formular.append("div").attr("class", "form-group");
  // Beschreibungstext
  map_radio.append("label").attr("for", "map_radio").text("Auswahl Darstellung");
  // Füge Radiobuttons ein
  map_radio = map_radio.append("div").attr("id", "map_radio");
  map_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="je" name="map_radio" checked>Verteilung der Jahreseinheiten');
  map_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="ant" name="map_radio">Marktanteil');
  map_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="gsb" name="map_radio">Gewichteter Schadenbedarf');
  map_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="sb" name="map_radio">Schadenbedarf');
  map_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="diff" name="map_radio">Differenz');
  map_radio.selectAll("input[name=map_radio]")
    .on("change", redrawMap);

  // Range-Selektor für Jahreseinheiten
  var map_range = formular.append("div").attr("class", "form-group");
  // Beschreibungstext
  map_range.append("label").attr("id", "lbl_map_range").text("Farbskala kalibriert anhand der Zulassungsbezirke mit mehr als 0 Jahreseinheiten.");
  // füge Range-Input ein
  map_range.append("input").attr("type", "range")
    .attr("id", "map_range")
    .style("width", "50%")
    .attr("min", 0).attr("max", 1000).attr("step", 1).attr("value", 0)
    .on("change", redrawMap);

  // Hinweistext
  formular.append("div")
    .attr("class", "form-group")
    .html("Mehr Informationen mit einem Mouseover. Ein Klick vergrößert den Kartenausschnitt.");

  // erzeuge leere Sub-Tabs für jede Ausgleichsgruppe
  var sub_tabs = tab.append("div").attr("class", "tab-content")
    .selectAll("div.tab-pane").data(["110", "210", "310"])
    .enter().append("div")
      .attr("class", function(d, i){
        cl = "tab-border tab-pane fade";
        if(i==0) cl += " active in";
        return cl;
      })
      .attr("id", function(d) { return "map"+d; });

  // Platz für Datenanzeige
  var spacer = tab.append("div").attr("class", "col-md-4");
  // Tabellarische Datenanzeige.
  map_data = spacer.append("div")
    .attr("id", "zb_list")
    .style("width", "100%")
    .style("height", map_height + "px")
    .append("div").attr("class", "panel-group");
  map_data.selectAll("div")
    .data(geojson.features, function(d) { return d.properties.zbn; })
    .enter().append("div")
      .attr("class", "panel panel-default")
      .each(function(d) {
        var el = d3.select(this);
        el.append("div").attr("class", "panel-heading")
          .style("cursor", "pointer")
          .text(d.properties.zb_name);
        el.append("div").attr("class", "panel-body")
            .html(d.properties.zbn);
      });

  map_data.selectAll("div.panel-heading")
    .on("click", function(d) { zoomToFeature(d.properties.zbn); });

  // Erzeuge SVG der Karte
  tab = tab.append("div").attr("class", "col-md-8");
  map = tab.append("svg")
      .attr("width", map_width)
      .attr("height", map_height)
      .on("click", stopped, true)        
      .call(zoom);
  map.append("rect")
    .attr("class", "background")
    .attr("width", map_width)
    .attr("height", map_height)
    .on("click", reset);
  map.append("g")
    .attr("class", "content_layer");
  // SVG für Choropleth-Skala
  map_legend = tab.append("svg")
      .attr("width", map_width/7)
      .attr("height", map_height)
      .append("g")
        .attr("class", "axis");
  map_legend.selectAll("rect")
    .data([1, 2, 3, 4, 5, 6, 7, 8, 9])
    .enter().append("rect")
      .attr("height", map_height/9)
      .attr("width", 20)
      .attr("y", function(d, i) { return map_height - map_height/9*(i+1); })
  // zeichne die Karte
  redrawMap();


  // --------------------------------------------------------------------------------------------
  // Detailübersicht über alle Ausgleichsgruppen
  // --------------------------------------------------------------------------------------------
  tab_ausglgr = main_tabs.filter(function(d) { return d=="ausglgr"; });
  // Array der Merkmale
  merkmale = d3.nest()
    .key(function(d) { return d.merkmal; })
    .entries(results.filter(function(d){ return d.merkmal!="zbn" & d.merkmal!="gesamt"; }));
  var setup = tab_ausglgr.append("div").attr("class", "row");

  // Erzeuge Auswahlmenü für Ausgleichsgruppe
  var sub_menu = setup.append("div").attr("class", "col-md-2");
  sub_menu.append("ul").attr("class", "nav nav-pills nav-stacked")
    .selectAll("li").data(ausgl_gr)
    .enter().append("li")
      .attr("class", function(d, i) { if (i==0){ return "active";}})
        .append("a")
          .attr("data-toggle", "pill")
          .attr("href", function(d) { return "#gr"+d.key; })
          .text(function(d) { return ausglgr_lbl[d.key]; });

  // Möglichkeiten für Einstellungen
  var formular = setup.append("div").attr("class", "col-md-10").append("form");

  // Checkboxen für Merkmale
  var merkmale_cb = formular.append("div")
    .attr("class", "form-group");
  // Beschreibungstext
  merkmale_cb.append("label")
    .attr("for", "merkmale_cb")
    .text("Auswahl Merkmale zur Anzeige");
  // Füge Checkboxen ein
  merkmale_cb = merkmale_cb.append("div").attr("id", "merkmale_cb");
  merkmale_cb.selectAll("label.checkbox-inline").data(merkmale)
    .enter().append("label")
    .attr("class", "checkbox-inline")
    .html(function(d){ return '<input type="checkbox" value="'+d.key+'" checked>'+merkmal_lbl[d.key]; });
  // EventListener für Checkboxen
  merkmale_cb.selectAll("input").on("change", function() {
    var merkmal = this.value;
    if(this.checked) {
      tabs.selectAll("div.panel").filter(function(d) { return d.key==merkmal; })
        .style("display", "block")
        .transition().duration(500)
        .style("opacity", 1);
    } else {
      tabs.selectAll("div.panel").filter(function(d) { return d.key==merkmal; })
        .transition().duration(500)
        .style("opacity", 0)
        .transition().duration(0)
        .style("display", "none");
    }
  });

  // Range-Selektor für Jahreseinheiten
  var detail_range = formular.append("div").attr("class", "form-group");
  // Beschreibungstext
  detail_range.append("label")
    .attr("id", "detail_range")
    .text("Zeige Datensätze mit mehr als 0 Jahreseinheiten.");
  // füge Range-Input ein
  detail_range.append("input").attr("type", "range")
    .style("width", "50%")
    .attr("min", 0).attr("max", 1000).attr("step", 1).attr("value", 0)
    .on("change", function() { applyThreshold(this.value); });

  // Radio-Button wechselt zwischen Marktanteil und Jahreseinheitenverteilung
  var je_radio = formular.append("div").attr("class", "form-group");
  // Beschreibungstext
  je_radio.append("label").attr("for", "je_radio").text("Anzeige Jahreseinheiten");
  // Füge Radiobutton ein
  je_radio = je_radio.append("div").attr("id", "je_radio");
  je_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="verteilung" name="je_radio" checked>als Verteilung');
  je_radio.append("label").attr("class", "radio-inline")
    .html('<input type="radio" value="marktanteil" name="je_radio">als Marktanteil');
  // Eventlistener
  je_radio.selectAll("input[name=je_radio]")
    .on("change", function() { applyJEDisplayChoice(this.value); });

  // Datenanzeige
  // Erzeuge Container für Inhalte
  var tabs = tab_ausglgr.append("div").attr("class", "tab-content")
    .selectAll("div.tab-pane").data(ausgl_gr)
    .enter().append("div")
      .attr("class", function(d, i){
        cl = "tab-border tab-pane fade";
        if(i==0) cl += " active in";
        return cl;
      })
      .attr("id", function(d) { return "gr"+d.key; })
        .append("div").attr("class", "container")
          .datum(function(d) { return d.key; });
  // Stelle Tabelle und Diagramm dar
  // pro Ausgleichsgruppen
  tabs.selectAll("div.panel").data(merkmale)
    .enter().append("div").attr("class", "panel panel-default")
    .each(function(d) {
      var merkmal = d.key,
      ausgl_gr = d3.select(this.parentNode).datum(),
      filtered = results.filter(function(e) { return e.ausgl_gr==ausgl_gr & (e.merkmal==merkmal | e.merkmal=="gesamt"); }),
      where = d3.select(this);
      // Überschrift pro Merkmal
      where.append("div").attr("class", "panel-heading")
        .append("h4")
        .text(merkmal_lbl[merkmal]);
      // Erzeuge Tabellenstruktur
      where = where.append("div").attr("class", "panel-body")
        .append("div").attr("class", "row");
      var table = where.append("div").attr("class", "col-md-4")
        .append("table").attr("class", "table table-striped")
        .datum({ausgl_gr: ausgl_gr, merkmal: merkmal});
      var thead = table.append("thead");
      var tbody = table.append("tbody");
      // Kopfzeile
      thead.append("tr")
        .selectAll("th")
        .data(columns).enter()
          .append("th").text(function(c) { return c.label; });
      // generiere Tabelleninhalte
      drawTable(filtered, ausgl_gr, merkmal);
      // Erzeuge SVG
      var svg = where.append("div").attr("class", "col-md-8")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", filtered.length*barWidth + margin.top + margin.bottom)
        .datum({ausgl_gr: ausgl_gr, merkmal: merkmal})
        .append("g")
          .attr("class", "content_layer")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      svg.append("g").attr("class", "sb axis");
      svg.append("g").attr("class", "je axis")
      // generiere Diagramminhalte
      drawBarchart(filtered, ausgl_gr, merkmal);
    }); 

  // --------------------------------------------------------------------------------------------
  // Downloadmöglichkeiten
  // --------------------------------------------------------------------------------------------
  var tab_downloads = main_tabs.filter(function(d) { return d=="download"; });
  tab_downloads.append("p").text("Hier könnten Downloads angeboten werden.");
}




