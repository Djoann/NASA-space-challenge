(function(context, L) {

    context.DebugGridLayer = L.TileLayer.Canvas
            .extend({
                options : {
                    noWrap : true,
                    continuousWorld : true
                },
                _createTileProto : function() {
                    var proto = this._canvasProto = L.DomUtil.create('div',
                            'leaflet-tile');
                    var tileSize = this.options.tileSize || 256;
                    proto.style.width = tileSize + "px";
                    proto.style.height = tileSize + "px";
                },
                drawTile : function(canvas, tilePoint, zoom) {
                    var tileSize = this.options.tileSize;
                    canvas.style.width = tileSize + "px";
                    canvas.style.height = tileSize + "px";
                    canvas.style.borderRight = "1px solid silver";
                    canvas.style.borderTop = "1px solid silver";
                    canvas.innerHTML = ("<div style='background-color: white; position: absolute; top: 0; right: 0; opacity:0.6; color: black; z-index: 10;'>"
                            + tilePoint.x + " : " + tilePoint.y + " - " + zoom + "</div>");
                }
            })

    function AnimateMixin() {
    }
    L.Util.extend(AnimateMixin.prototype, {
        activateAnimation : function() {
            this._container.on({
                'zoomanim' : this._animateZoomBegin,
                'zoomend' : this._animateZoomEnd
            }, this);
        },
        deactivateAnimation : function() {
            this._container.off({
                'zoomanim' : this._animateZoomBegin,
                'zoomend' : this._animateZoomEnd
            }, this);
        },

        _getTranslateString : function(center, zoom) {
            var container = this.getContainer();
            var topLeft = this.getTopLeft();
            var bottomRight = this.getBottomRight();

            var crs = container.options.crs;
            var layerZoom = this.getLayerZoom();
            var scale = crs.scale(zoom) / crs.scale(layerZoom);

            var topLeftPoint;
            var bottomRightPoint;

            var currentZoom = container.getZoom();
            if (currentZoom != zoom) {
                topLeftPoint = container._latLngToNewLayerPoint(topLeft, zoom,
                        center);
                bottomRightPoint = container._latLngToNewLayerPoint(
                        bottomRight, zoom, center);
            } else {
                topLeftPoint = container.latLngToLayerPoint(topLeft);
                bottomRightPoint = container.latLngToLayerPoint(bottomRight)
            }

            var origin = topLeft;
            {
                var size = bottomRightPoint.subtract(topLeftPoint);
                origin = topLeftPoint.add(size.multiplyBy(1 / (2 * scale)));

            }
            return L.DomUtil.getTranslateString(origin) + ' scale(' + scale
                    + ') ';

            var size = bottomRightPoint._subtract(topLeftPoint);
            var origin = topLeftPoint._add(size._multiplyBy((1 / 2)
                    * (1 - 1 / scale)));

            // var center = topLeft.clone().add(bottomRight).divideBy(2);
            // var normalizedCenter = center.divideBy(scale);
            // var origin1 = normalizedCenter.subtract(center);
            //
            // var size = bottomRight.subtract(topLeft);
            // var scaledSize = size.divideBy(1 / (2 * scale));
            // var origin2 = topLeft.add(scaledSize);
            // // origin2 = topLeft.divideBy(1).add(scaledSize);
            //
            // var origin = origin2;
            //            
            // origin = container.layerPointToLatLng(normalizedCenter);

            console.log(scale, "TopLeft: " + JSON.stringify(topLeft),
                    "BottomRight: " + JSON.stringify(bottomRight))

            var str = L.DomUtil.getTranslateString(origin) + ' scale(' + scale
                    + ')';
            return str;
        },

        _animateZoomBegin : function(e) {
            var element = this.getElement();
            if (!element)
                return;
            var str = this._getTranslateString(e.center, e.zoom);
            element.style[L.DomUtil.TRANSFORM] = str;
        },

        _animateZoomEnd : function() {
        }
    });

    context.Timeline = Timeline;
    function Timeline(options) {
        this.initialize(options);
    }
    L.Util.extend(Timeline.prototype, AnimateMixin.prototype)
    L.Util
            .extend(
                    Timeline.prototype,
                    {
                        initialize : function(options) {
                            options = L.Util.setOptions(this, options);
                        },
                        _newElement : function() {
                            var div = L.DomUtil.create('div',
                                    'my-custom-layer leaflet-zoom-animated');
                            div.innerHTML = "<div style='background-color:white; padding:0; margin: 0;'>"
                                    + "<h1 style='margin: 0; padding:0;'>Hello, world</h1>"
                                    + "<p>This is a simple paragraph with a <a href='http://www.google.com'>reference</a>.</p>"
                                    + "</div>";
                            return div;
                        },
                        toTranslatedCanvasPosition : function(position, zoom,
                                center) {
                            var container = this.getContainer();
                            // alert("xxx")
                            return container._latLngToNewLayerPoint(position,
                                    zoom, center);
                        },
                        toCanvasPosition : function(position) {
                            var container = this.getContainer();
                            return container.latLngToLayerPoint(position);
                        },
                        getCenter : function() {
                            var topLeft = this.getTopLeft();
                            var bottomRight = this.getBottomRight();
                            var center = L.latLng(topLeft);
                            center.lat = (center.lat + bottomRight.lat) / 2;
                            center.lng = (center.lng + bottomRight.lng) / 2;
                            return center;
                        },
                        getTopLeft : function() {
                            // return this.options.topLeft;
                            return new L.LatLng(this.options.topLeft.lat,
                                    this.options.topLeft.lng);
                        },
                        getBottomRight : function() {
                            var options = this.options;
                            if (!options.bottomRight) {
                                var element = this.getElement();
                                var width = element.offsetWidth;
                                var height = element.offsetHeight;

                                var container = this.getContainer();
                                var tl = container
                                        .latLngToLayerPoint(options.topLeft);
                                var size = L.point(height, width);
                                var br = tl.add(size);
                                var bottomRight = container
                                        .layerPointToLatLng(br);
                                options.bottomRight = bottomRight;

                                // FIXME: remove markers
                                L.marker(
                                        L.latLng(options.topLeft.lat,
                                                options.topLeft.lng)).addTo(
                                        container);
                                L.marker(
                                        L.latLng(options.bottomRight.lat,
                                                options.bottomRight.lng))
                                        .addTo(container);
                            }
                            return options.bottomRight;
                        },
                        getElement : function() {
                            return this._element;
                        },
                        getContainer : function() {
                            return this._container;
                        },
                        getLayerZoom : function() {
                            return this.options.zoom;
                        },
                        onAdd : function(container) {
                            this._container = container;
                            this._element = this._newElement();
                            container.getPanes().overlayPane
                                    .appendChild(this._element);
                            container.on('viewreset', this._reset, this);
                            this.activateAnimation();
                            this._reset();
                        },
                        onRemove : function(container) {
                            this.deactivateAnimation();
                            container.getPanes().overlayPane
                                    .removeChild(this._element);
                            container.off('viewreset', this._reset, this);
                        },
                        _reset : function() {
                            var position = this.getTopLeft();
                            var canvasPosition = this
                                    .toCanvasPosition(position);
                            var element = this.getElement();
                            L.DomUtil.setPosition(element, canvasPosition);

                            // var container = this.getContainer();
                            // var center = this.getCenter();
                            // var zoom = container.getZoom();
                            // var str = this._getTranslateString(center, zoom);
                            // element.style[L.DomUtil.TRANSFORM] = str;
                        }
                    });

})(this, L);