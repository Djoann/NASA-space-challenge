#!/bin/bash
dir=`dirname $0`
cd "$dir"
cd ../
/usr/bin/nodejs "server/web-server.js"
 