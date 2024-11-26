
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

function update_hash() {
		const {lat, lng} = this.getCenter();
		const zoom = this.getZoom();
		const digits = 4;
		window.history.replaceState(null, '', `#map=${zoom}/${lat.toFixed(digits)}/${lng.toFixed(digits)}`);
}

function onHashChange() {
		const hash = document.location.hash;
		const coords = decodeURIComponent(hash.slice(5)).split("/") // strip off the #map= part
		const latLng = L.latLng(parseFloat(coords[1]), parseFloat(coords[2]));
		map.setView(latLng, parseInt(coords[0]));
}

map.on("moveend", update_hash);
map.on("zoomend", update_hash);

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

window.addEventListener("hashchange", onHashChange);
onHashChange();

