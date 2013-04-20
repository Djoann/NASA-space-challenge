(function(context, L) {
    // This is a workaround for a leaflet hard-coded zoom level
    // http://stackoverflow.com/questions/13154295/adding-an-extra-zoom-levels-in-leaflet-maps
    L.TileLayer.prototype._getWrapTileNum = function() {
        return this._map.options.crs.scale(this._getZoomForUrl());
    }

    var statics = {
        getMaxZoomLevel : function(size) {
            var n = Math.ceil(Math.log(size) / Math.log(2));
            return n;
        },
        getMinZoomLevel : function(size) {
            var n = Math.floor(Math.log(size) / Math.log(2));
            return n;
        },
        _getNormalizedSize : function(size, zoom) {
            var fullSize = Math.pow(2, zoom);
            var result = size / fullSize;
            return result;
        },
        getSizeFromPixels : function(size) {
            var zoom = statics.getMaxZoomLevel(size);
            var result = statics._getNormalizedSize(size, zoom);
            return result;
        },
        getDimensions : function(width, height) {
            var wZoom = statics.getMaxZoomLevel(width);
            var hZoom = statics.getMaxZoomLevel(height);
            var zoom = Math.max(wZoom, hZoom);
            var w = statics._getNormalizedSize(width, zoom);
            var h = statics._getNormalizedSize(height, zoom);
            return {
                width : w,
                height : h,
                zoom : zoom
            }
        },
        getBounds : function(width, height) {
            var wZoom = statics.getMinZoomLevel(width);
            var hZoom = statics.getMinZoomLevel(height);
            var zoom = Math.max(wZoom, hZoom);
            var w = statics._getNormalizedSize(width, zoom);
            var h = statics._getNormalizedSize(height, zoom);
            return {
                width : w,
                height : h,
                zoom : zoom
            }
        }
    }
    context.FractalView = L.Map.extend({
        statics : statics,
        options : {
            crs : L.extend({}, L.CRS, {
                projection : L.Projection.LonLat,
                transformation : new L.Transformation(1, 0, 1, 0),
                scale : function(zoom) {
                    return Math.pow(2, zoom);
                }
            }),
            worldCopyJump : false,
            noWrap : true,
            continuousWorld : true,
            attributionControl : false
        },
        initialize : function(id, options) {
            if (!options.zoom) {
                options.zoom = 8;
            }
            if (!options.minZoom) {
                options.minZoom = 0;
            }
            if (!options.maxZoom) {
                options.maxZoom = 32;
            }
            L.Map.prototype.initialize.apply(this, [ id, options ]);
        },

        _resetView : function(center, zoom, preserveMapOffset, afterZoomAnim) {
            this._nextZoomLevel = zoom;
            L.Map.prototype._resetView.call(this, center, zoom,
                    preserveMapOffset, afterZoomAnim);
        },

        fitView : function(viewportWidth, viewportHeight, imageWidth,
                imageHeight) {
            var imgDim = FractalView.getDimensions(imageWidth, imageHeight);
            var viewDim = FractalView.getBounds(viewportWidth, viewportHeight);
            var w = Math.min(imgDim.width, viewDim.width);
            var h = Math.min(imgDim.height, viewDim.height);
            var z = Math.min(imgDim.zoom, viewDim.zoom);
            this.setView(L.latLng(h / 2, w / 2), z);
        },

        fitBoundsToView : function(viewportWidth, viewportHeight, topLeft,
                bottomRight, zoom) {
            var wZoom = statics.getMinZoomLevel(viewportWidth);
            var hZoom = statics.getMinZoomLevel(viewportHeight);
            var z = Math.max(wZoom, hZoom);
            if (zoom) {
                z = Math.max(z, zoom);
            }
            var point = L.latLng((topLeft.lat + bottomRight.lat) / 2,
                    (topLeft.lng + bottomRight.lng) / 2);
            this.setView(point, z);
        }
    });

    /** This layer is used to visualize images in DeepZoom format */
    context.DeepZoomCanvas = L.TileLayer
            .extend({
                options : {
                    noWrap : true,
                    continuousWorld : true
                },
                initialize : function(options) {
                    // options.maxZoom = options.zoom;
                    var url = options.url;
                    if (options.reloadTiles) {
                        url = url + "?" + Math.random();
                    }
                    L.TileLayer.prototype.initialize.apply(this,
                            [ url, options ]);
                    this._originalTileSize = this.options.tileSize;
                },
                onAdd : function(map) {
                    map.on('zoomanim', this._updateTileSizeCallback, this);
                    L.TileLayer.prototype.onAdd.call(this, map);
                },
                onRemove : function(map) {
                    L.TileLayer.prototype.onRemove.call(this, map);
                    map.off('zoomanim', this._updateTileSizeCallback, this);
                },
                _updateTileSizeCallback : function(e) {
                    this._updateTileSize(e.zoom);
                },
                _updateTileSize : function(zoom) {
                    if (this._lastZoom == zoom) {
                        return;
                    }
                    var scale = 1;
                    var maxZoom = this._getMaxZoom();
                    var zoomDelta = zoom - maxZoom;
                    if (zoomDelta > 0) {
                        scale = Math.pow(2, zoomDelta);
                    }
                    this.options.tileSize = this._originalTileSize * scale;
                    this._lastZoom = zoom;
                },
                _update : function() {
                    this._updateTileSize(this._map.getZoom());
                    L.TileLayer.prototype._update.call(this);
                },
                _getMaxZoom : function() {
                    return this.options.zoom;
                },
                getTileUrl : function(tilePoint) {
                    var zoom = this._getZoomForUrl();
                    this._adjustTilePoint(tilePoint);
                    var url = L.Util.template(this._url, L.extend({
                        s : this._getSubdomain(tilePoint),
                        z : this._getZoomForUrl(zoom),
                        x : tilePoint.x,
                        y : tilePoint.y
                    }));
                    return url;
                },
                _getTileScale : function(zoom) {
                    var crs = this._map.options.crs;
                    var scale = crs.scale(zoom) / crs.scale(8);
                    return scale;
                },
                _getZoomForUrl : function() {
                    var options = this.options;
                    var zoom = this._map.getZoom();
                    var maxZoom = this._getMaxZoom();
                    var zoomDelta = zoom - maxZoom;
                    if (zoomDelta > 0) {
                        zoom = maxZoom;
                    }
                    if (options.zoomReverse) {
                        zoom = -zoomDelta;
                    }
                    return zoom + options.zoomOffset;
                },
                _tileShouldBeLoaded : function(tilePoint) {
                    var result = false;
                    if (tilePoint.x >= 0 && tilePoint.y >= 0) {
                        var tileSize = this._getTileSize(tilePoint);
                        result = tileSize.x > 0 && tileSize.y > 0;
                    }
                    if (result) {
                        result = L.TileLayer.prototype._tileShouldBeLoaded
                                .call(this, tilePoint);
                    }
                    return result;
                },
                _resetTile : function(tile) {
                    tile.style.width = tile.style.height = this.options.tileSize
                            + 'px';
                    L.TileLayer.prototype._resetTile.apply(this, [ tile ]);
                },
                _loadTile : function(tile, tilePoint) {
                    L.TileLayer.prototype._loadTile.apply(this, [ tile,
                            tilePoint ]);
                    var tileSize = this._getTileSize(tilePoint);
                    tile.style.width = tileSize.x + "px";
                    tile.style.height = tileSize.y + "px";
                    tile.style[L.DomUtil.TRANSITION] = "opacity 3s ease-in-out;"
                },
                _getTileSize : function(tilePoint) {
                    // Scaled image size
                    var zoom = this._map.getZoom();
                    var scale = this._getTileScale(zoom);
                    var originalTileSize = this._originalTileSize;
                    var imageWidth = this.options.width * originalTileSize
                            * scale;
                    var imageHeight = this.options.height * originalTileSize
                            * scale;
                    // Define the real size of the tile
                    var tileSize = this.options.tileSize;
                    var w = Math.min(tileSize, imageWidth - tilePoint.x
                            * tileSize);
                    var h = Math.min(tileSize, imageHeight - tilePoint.y
                            * tileSize);
                    var result = L.point(w, h);
                    return result;
                }

            });

})(this, L);