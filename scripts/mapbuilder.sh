#!/bin/bash

[ -n "$1" -a -n "$2" ] || {
	echo "Usage: $0 INPUT_DIRECTORY OUTPUT_DIRECTORY"
	exit 1
}

temp=$(mktemp -d)
zoom=$(jq '.maxZoom // 10' "$1/layers.json")

mkdir "$temp/data"
for i in "$1/data/"*
do	
	ogrmerge.py -single -o "$temp/$(basename $i).json"  "$i"/* 
done


tippecanoe -aN -z"$zoom" -o "$temp/strecken.pmtiles" $temp/*.json

mv $temp/strecken.pmtiles "$2"

rm -r $temp
