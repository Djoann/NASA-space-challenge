#!/bin/bash
dir=`dirname $0`
cd "$dir"
cd ../
node "server/web-server.js"
 