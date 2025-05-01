function layer_legend(layer) {
		return '<span class="dot" style="background: ' + layer["color"] + '" ></span>' + layer["name"];
}

function disable_events(element) {
		L.DomEvent.disableClickPropagation(element);
		element.addEventListener('mouseover', L.DomEvent.stopPropagation);
		element.addEventListener('click', L.DomEvent.preventDefault)
		element.addEventListener('click', L.DomEvent.stopPropagation)
}


const rules = new Array;
const l = new Array;
const legend = L.control({position: 'bottomleft'});
legend.onAdd = function (map) {
		const div = L.DomUtil.create('div', 'legend');
		for (let i = 0; i < l.length; i++) {
			  div.innerHTML += layer_legend(l[i]) + "<br>";
		}
		disable_events(div);
		return div;
};


const map = L.map("map", {  center: [52,13], zoom: 3, minZoom: 0 });
map.attributionControl.setPrefix('Made with <a href="https://github.com/homologic/streckenkarte" > Streckenkarte</a>' );


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


let pointPaintRules = [
		{
				dataLayer: "points",
				symbolizer: new protomapsL.CircleSymbolizer({
						radius: 3,
						fill: 'black',
						stroke: 'white',
						width: 1.5,
				}),
				filter: (z,f) => { return f.props.zoom > 0 && f.props.zoom < z  }
		}
]

let pointRules = [
		{
				dataLayer: "points",
				symbolizer: 
				new protomapsL.OffsetTextSymbolizer({
						labelProps: ["name_local", "name_lat"],
						offsetX: 6,
						offsetY: 4.5,
						fill: 'black',
						width: 2,
						stroke: 'white',
						lineHeight: 1.5,
						letterSpacing: 1,
						font: (z, f) => {
								const size = protomapsL.linear([
										[3, 10],
										[10, 12],
								])(z);
								return `400 ${size}px sans-serif`;		
						},
				}),
				filter: (z,f) => { return f.props.zoom > 0 && f.props.zoom < z  },
				sort: (a,b) => { return a.zoom - b.zoom }
		}
];

fetch("layers.json")
		.then((response) => response.json())
		.then((data) => {
				document.title = data["name"]
				const layers = data["layers"]
				for (let key in layers) {
						let layer = layers[key]
						layer.name = layer['humanname']
						layer.dirname = key
						l.push(layer)
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
						attribution: "",
						url: data["pmtiles_url"] ?? "strecken.pmtiles",
						maxDataZoom: data["maxZoom"] ?? 10,
						maxZoom: 19,
						paintRules: rules,	
				});
				osm.addTo(map);
				legend.addTo(map);
				strecken.addTo(map);
				if ("points_url" in data) {
						const points = protomapsL.leafletLayer({
								attribution: "",
								url: data["points_url"],
								maxDataZoom: data["maxZoom"] ?? 10,
								maxZoom: 19,
								labelRules: pointRules,
								paintRules: pointPaintRules,
						});
						points.addTo(map);
				}
		})




let dirHandle;
let editMode = false;
let markers = [];
let anglemarkers = [];
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

function computeVector(coords, i) {
		return [coords[i][0] - coords[i-1][0], coords[i][1] - coords[i-1][1]];
}

function scalarProduct(a,b) {
		return a[0] * b[0] + a[1] * b[1]
}

async function recompute_anglemarkers(g) {
		for (k=0; k < anglemarkers.length ; k++) {
				map.removeLayer(anglemarkers[k])
		}
		anglemarkers = [];
		const limit = document.getElementById("angle").value
		
		for (j=0; j< g.length; j++) {
				const coords = g[j].geometry.coordinates;
				for (let i=1; i < coords.length - 1; i++) {
						const a = computeVector(coords,i);
						const b = computeVector(coords,i+1);
						let angle = Math.acos(scalarProduct(a,b)/Math.sqrt(scalarProduct(a,a)*scalarProduct(b,b)))
						if (angle > limit ) {
								let mark = new L.marker(L.latLng(coords[i][1],coords[i][0]))
								anglemarkers.push(mark);
								mark.addTo(map);
								mark._icon.classList.add("warn");
						}
				}
		}
}

async function updateBrouter () {
		if (markers.length > 0) {
				for (i=0; i< markers.length; i++) {
						markers[i]._icon.classList.remove("red");
						markers[i]._icon.classList.remove("darkred");
				}
				markers[markers.length-1]._icon.classList.add("red");
				markers[0]._icon.classList.add("green");
		}
		geojsons = [];
		recompute_anglemarkers(geojsons);
		if (geojson != undefined) {
				map.removeLayer(geojson);
		}
		if (markers.length < 2) {
				return;
		}
		for (let i = 0; i < markers.length - 1 ; i++) {
				const marker1 = markers[i].getLatLng();
				const marker2 = markers[i+1].getLatLng();
				const profile = document.querySelector("#brouter-profile").value;
				const url = `https://brouter.de/brouter?lonlats=${marker1.lng},${marker1.lat}|${marker2.lng},${marker2.lat}&profile=${profile}&alternativeidx=0&format=geojson`;
				fetch(url).then((response) => {
						if (!response.ok) {
								throw new Error("HTTP error " + response.status);
						}
						return response.json()
				})
						.then((data) => {
								if (geojson != undefined) {
										map.removeLayer(geojson);
								}
								delete data.features[0].properties.messages;
								geojsons.push(data.features[0]);
								recompute_anglemarkers(geojsons);
								const dat = {type: "FeatureCollection", features: geojsons};
								geojson = addGeoJsonToMap(dat);
						})
						.catch(err => {
								markers[i]._icon.classList.add("darkred");
								markers[i+1]._icon.classList.add("darkred");
						}
						)
		}
}

map.on('click', function(e) {
		if (!editMode) {
				return;
		}
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


async function quitEdit(e) {
		for (i=0; i< markers.length; i++) {
				map.removeLayer(markers[i]);
		}

		markers = []
		updateBrouter()
		recompute_anglemarkers([]);
		e.stopPropagation()
		L.DomEvent.preventDefault(e);
		editMode = false;
		document.querySelector(".edit-ui").style.display = "none";
		document.getElementById("edit-mode").style.display = "block";
}

async function pickDirectory(e){
		e.stopPropagation()
		L.DomEvent.preventDefault(e);
		if (!editMode) {
				dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
				if (!dirHandle) {
						return;
				}
				const layerspan = document.querySelector("#layername")
				layerspan.innerHTML = ""
				for (i = 0; i < l.length ; i++ ) {
						if (l[i].dirname === dirHandle.name) {
								editlayer = l[i];
								const profile = editlayer["brouter-profile"] ?? "rail" ;
								document.querySelector("#brouter-profile").value = profile;
								layerspan.innerHTML = "Editing layer " + layer_legend(l[i]) + "<br>" 
								break;
						}
				}
				editMode = true;
				document.getElementById("edit-mode").style.display = "none";
				document.querySelector(".edit-ui").style.display = "block";
		} else {
				if (geojsons.length < 1) {
						alert("There is no path to save!");
						return;
				}
				const filename = window.prompt("Enter filename:", "test");
				if (!filename) {
						return;
				}
				const dat = {type: "FeatureCollection", features: geojsons};
				let file;
				try {
						file = await dirHandle.getFileHandle(`${filename}.geojson`, {
								create: true
						});
				} catch (error) {
						alert(`Could not open file: ${error.message}`);
						return
				}
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
						disable_events(buttonDiv)
						buttonDiv.innerHTML = `<button id="edit-mode" onClick="pickDirectory(event)" >Edit</button>
<div class="edit-ui">
<div id="layername" ></div>
<label for="brouter-profile">Brouter Profile</label><br>
<input type="text" id="brouter-profile" onchange="updateBrouter()" ><br>
<label for="angle">Turn restriction sensitivity</label><br>
<input type="range" min="0" step="0.05" max="1" value="0.35" class="slider" id="angle" onchange="recompute_anglemarkers(geojsons)" ><br>
<button id="save" onClick="pickDirectory(event)" >Save</button><button id="quit" onclick="quitEdit(event)" >Quit</button>
</div>`
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



