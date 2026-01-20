#!/usr/bin/python3

import re
import requests
import json
import os
import argparse

parser = argparse.ArgumentParser(description='Export Umap maps for use with streckenkarte')
parser.add_argument("URL", help="The map's URL")
parser.add_argument("output_dir", help="Output directory")
parser.add_argument("-s", "--separate", action='store_true', help="Separate output into different files")

args = parser.parse_args()
url = args.URL
outdir = args.output_dir
separate = args.separate


base = url.split("/map/")[0]
r = requests.get(url)

new_umap = True

if "new Umap" in r.text :
    new_umap = True

text = re.sub("&quot;", '"',r.text)
properties_string = re.search(r'data-settings="(.*)"\>\<\/script\>', text).group(1)

data = json.loads(properties_string)	

properties = data["properties"]
layers = properties["datalayers"]
map_id = properties["id" if new_umap else "umap_id"]

config = {}
config["name"] = properties["name"]
colors = {}
config["layers"] = colors
config["overlay"] = properties["overlay"]

if "tilelayer" in properties and properties['tilelayer'] != {} :
    config["tilelayer"] = properties["tilelayer"]
    config["tilelayer"]["attribution"] = re.sub(r'\[\[([^|]+)\|([^|]+)\]\]', r'<a href="\1" >\2</a>', config["tilelayer"]["attribution"])
else :
    config["tilelayer"] = { "attribution" : 'Map data ©  <a href="http://osm.org/copyright" >OpenStreetMap contributors</a>', "url_template" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }

def normalize_name(name) :
    return name.replace("/", "_").replace("-","").replace(" ","").replace(".","")

datadir = os.path.join(outdir,"data")
rawdir = os.path.join(outdir,"raw")
if not os.path.exists(outdir) :
    os.mkdir(outdir)
if not os.path.exists(datadir) :
    os.mkdir(datadir)
if separate:
    if not os.path.exists(rawdir) :
        os.mkdir(rawdir)

for layer in layers :
    layer_id = layer["id"]
    req = requests.get(f"{base}/datalayer/{map_id}/{layer_id}/")
    options = req.json()["_umap_options"]
    nname = normalize_name(options['name'])
    if not os.path.exists(os.path.join(datadir,nname)) :
        os.mkdir(os.path.join(datadir,nname))
    if separate:
        with open(os.path.join(rawdir,f"{nname}.json"), "w") as f :
            f.write(req.text)
    else:
        with open(os.path.join(datadir,nname,f"{nname}.json"), "w") as f :
            f.write(req.text)
         
    #Store each path separately if requested via flag
    if separate:
        #Counter to name files if the feature does not have a name itself
        counter = 0
        for path in json.loads(req.text)["features"]:
    	    #Check whether a name is given, else count up
    	    if "name" in path["properties"]:
    	        pname = path["properties"]["name"]
    	    else:
    	        pname = str(counter)
    	    with open(os.path.join(datadir,nname,f"{pname}.json"), "w") as f :
                f.write(json.dumps(path))
            	
    colors[nname] = { "color" : options["color"] if "color" in options else "DarkGreen" , "humanname" : options["name"] }
    if "weight" in options :
        colors[nname]["width"] = options["weight"]
    else:
        colors[nname]["width"] = 2

with open(os.path.join(outdir,"layers.json"), "w") as f :
    json.dump(config, f, indent=4)
