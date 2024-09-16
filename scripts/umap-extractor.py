#!/usr/bin/python3

import re
import requests
import json
import os
import argparse

parser = argparse.ArgumentParser(description='Export Umap maps for use with streckenkarte')
parser.add_argument("URL", help="The map's URL")
parser.add_argument("output_dir", help="Output directory")

args = parser.parse_args()
url = args.URL
outdir = args.output_dir

base = url.split("/map/")[0]
r = requests.get(url)

regexp = re.compile(r'U.MAP = new U.Map[(]"map", (.+) }\)', re.DOTALL)

data = json.loads(regexp.findall(r.text, re.DOTALL)[0].replace("})","}"))

properties = data["properties"]
layers = properties["datalayers"]
map_id = properties["umap_id"]

config = {}
config["name"] = properties["name"]
colors = {}
config["layers"] = colors

if "tilelayer" in properties and properties['tilelayer'] != {} :
    config["tilelayer"] = properties["tilelayer"]
    config["tilelayer"]["attribution"] = re.sub(r'\[\[([^|]+)\|([^|]+)\]\]', r'<a href="\1" >\2</a>', config["tilelayer"]["attribution"])
else :
    config["tilelayer"] = { "attribution" : 'Map data ©  <a href="http://osm.org/copyright" >OpenStreetMap contributors</a>', "url_template" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }

def normalize_name(name) :
    return name.replace("/", "_").replace("-","").replace(" ","").replace(".","")

datadir = os.path.join(outdir,"data")
if not os.path.exists(outdir) :
    os.mkdir(outdir)
if not os.path.exists(datadir) :
    os.mkdir(datadir)

for layer in layers :
    layer_id = layer["id"]
    req = requests.get(f"{base}/datalayer/{map_id}/{layer_id}/")
    options = req.json()["_umap_options"]
    nname = normalize_name(options['name'])
    if not os.path.exists(os.path.join(datadir,nname)) :
        os.mkdir(os.path.join(datadir,nname))
    with open(os.path.join(datadir,nname,f"{nname}.json"), "w") as f :
        f.write(req.text)
    colors[nname] = { "color" : options["color"] if "color" in options else "DarkGreen" , "humanname" : options["name"] }
    if "weight" in options :
        colors[nname]["width"] = options["weight"]
    else:
        colors[nname]["width"] = 2

with open(os.path.join(outdir,"layers.json"), "w") as f :
    json.dump(config, f, indent=4)
