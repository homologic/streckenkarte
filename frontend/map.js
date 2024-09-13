
const rules = new Array;
const l = new Array;
var legend = L.control({position: 'bottomleft'});
legend.onAdd = function (map) {
		var div = L.DomUtil.create('div', 'legend');
		for (var i = 0; i < l.length; i++) {
			  div.innerHTML += '<span class="dot" style="background: ' + l[i]["color"] + '" ></span>' + l[i]["name"] + "<br>";
		}
		return div;
};


const map = L.map("map", {  center: [52,13], zoom: 3, minZoom: 0 });
fetch("layers.json")
		.then((response) => response.json())
		.then((data) => {
				document.title = data["name"]
				layers = data["layers"]
				for (let key in layers) {
						l.push({ name: layers[key]["humanname"], color: layers[key]["color"] });
						rules.push({
								dataLayer: key,
								symbolizer: new protomapsL.LineSymbolizer(layers[key])
						});
				}
				const tiles = data["tilelayer"]
				var osm = L.tileLayer(
						tiles["url_template"],
						{
								maxZoom: 19,
								attribution: tiles["attribution"]
						}
				);
				var strecken = protomapsL.leafletLayer({
						url: "strecken.pmtiles",
						maxDataZoom: data["maxZoom"] ?? 10,
						maxZoom: 19,
						paintRules: rules,	
				});

				osm.addTo(map);
				legend.addTo(map);
				strecken.addTo(map);
		})

function resize() {
	document.getElementById("map").style.height = window.innerHeight + 'px';
}
resize();
window.addEventListener('resize', () => {
	resize();
});

