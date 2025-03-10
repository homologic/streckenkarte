function layer_legend(layer) {
		return '<span class="dot" style="background: ' + layer["color"] + '" ></span>' + layer["name"];
}

const rules = new Array;
const l = new Array;
const legend = L.control({position: 'bottomleft'});
legend.onAdd = function (map) {
		const div = L.DomUtil.create('div', 'legend');
		for (let i = 0; i < l.length; i++) {
			  div.innerHTML += layer_legend(l[i]) + "<br>";
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
				const layers = data["layers"]
				for (let key in layers) {
						l.push({ dirname: key , name: layers[key]["humanname"], color: layers[key]["color"] });
						rules.push({
								dataLayer: key,
								symbolizer: new protomapsL.LineSymbolizer(layers[key])
						});
				}
				const tiles = data["tilelayer"]
				const osm = L.tileLayer(
						tiles["url_template"],
						{
								maxZoom: 19,
								attribution: tiles["attribution"]
						}
				);
				const strecken = protomapsL.leafletLayer({
						url: "strecken.pmtiles",
						maxDataZoom: data["maxZoom"] ?? 10,
						maxZoom: 19,
						paintRules: rules,	
				});

				osm.addTo(map);
				legend.addTo(map);
				strecken.addTo(map);
		})

let dirHandle;
let editMode = false;
let markers = [];
let geojsons = [];
let geojson;
let editlayer;

function addGeoJsonToMap(dat) {
		if (editlayer != undefined) {
				const style = {
						"color": editlayer.color
				};
				g = L.geoJSON(dat, {style: style});
		} else {
				g = L.geoJSON(dat);
		}
		g.addTo(map);
		return g;
}

async function updateBrouter () {
		if (markers.length > 0) {
				for (i=1; i< markers.length-1; i++) {
						markers[i]._icon.classList.remove("red");
				}
				markers[markers.length-1]._icon.classList.add("red");
				markers[0]._icon.classList.add("green");
		}
		if (markers.length < 2) {
				if (geojson != undefined) {
						map.removeLayer(geojson);
				}
				return;
		}
		geojsons = [];
		for (let i = 0; i < markers.length - 1 ; i++) {
				const marker1 = markers[i].getLatLng();
				const marker2 = markers[i+1].getLatLng();
				const url = `https://brouter.de/brouter?lonlats=${marker1.lng},${marker1.lat}|${marker2.lng},${marker2.lat}&profile=rail&alternativeidx=0&format=geojson`;
				fetch(url).then((response) => response.json())
						.then((data) => {
								if (geojson != undefined) {
										map.removeLayer(geojson);
								}
								geojsons.push(data.features[0]);
								const dat = {type: "FeatureCollection", features: geojsons};
								geojson = addGeoJsonToMap(dat);
						})
		}
}

map.on('click', function(e) {
		// if (!editMode) {
		// 		return;
		// }
		marker = new L.marker(e.latlng, {draggable: true}) ;
		markers.push(marker);
		marker.on("click", function(e) {
				map.removeLayer(this);
				markers = markers.filter(item => item != this);
				updateBrouter();
		})
		marker.on("dragend", function(e) {
				updateBrouter();
		});
		marker.addTo(map);
		updateBrouter();
});


async function pickDirectory(e){
		e.stopPropagation()
		L.DomEvent.preventDefault(e);
		if (!editMode) {
				dirHandle = await window.showDirectoryPicker();
				for (i = 0; i < l.length ; i++ ) {
						console.log(l[i].dirname);
						if (l[i].dirname === dirHandle.name) {
								editlayer = l[i];
								this.innerHTML = "Editing layer " + layer_legend(l[i]) + "<br>" + this.innerHTML
								break;
						}
				}

				document.getElementById("edit-mode").style.color = "red";
				document.getElementById("edit-mode").innerHTML = "save";
				editMode = true;
		} else {
				const filename = window.prompt("Enter filename:", "test");
				const dat = {type: "FeatureCollection", features: geojsons};
				const file = await dirHandle.getFileHandle(`${filename}.geojson`, {
						create: true
				});
				const blob = new Blob([JSON.stringify(dat)]);
				const writableStream = await file.createWritable();
				await writableStream.write(blob);
				await writableStream.close();
				addGeoJsonToMap(dat);
				for (i=0; i<markers.length; i++) {
						map.removeLayer(markers[i]);
				}
				markers = [];
				updateBrouter();
				alert("Saved file!");
		}
}

const searchParams = new URLSearchParams(window.location.search)
const edit = searchParams.get("edit");

if (edit) {
		const customButton = L.control({ position: 'topright' });
		customButton.onAdd = () => {
				const buttonDiv = L.DomUtil.create('div', 'legend');
				if ("showDirectoryPicker" in window) {
						buttonDiv.innerHTML = `<button id="edit-mode" >Edit</button>`;
						buttonDiv.addEventListener('click', pickDirectory, this)
				} else {
						buttonDiv.innerHTML = "Your browser does not support editing. <br> As of 2025, editing is supported on Chromium-based browsers only.";
				}
				return buttonDiv;
		};
		customButton.addTo(map)
}


function resize() {
	document.getElementById("map").style.height = window.innerHeight + 'px';
}
resize();
window.addEventListener('resize', () => {
	resize();
});

window.addEventListener("hashchange", onHashChange);
onHashChange();



