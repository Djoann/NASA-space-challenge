(function() {

    /* --------------------------------------------------------------------- */
    /**
     * This class is used to bind zoomable images with the specified HTML
     * element
     */
    function ImageCanvas(options) {
        this.options = options;
        var e = $(this.options.element).get(0);
        this.view = new FractalView(e, {
            minZoom : options.minZoom,
            maxZoom : options.maxZoom,
            zoom : (options.zoom || options.minZoom)
        });
        this.view.on('viewreset', this._onViewReset, this);
        this.initDebug(options);
    }

    /** This internal method is called to notify about changes of the zoom level */
    ImageCanvas.prototype._onViewReset = function() {
        if (this.markerGroup) {
            this.markerGroup.eachLayer(function(marker) {
                this._updateMarker(marker);
            }, this);
        }
    }

    /** An internal method setting a zoomable image on the screen */
    ImageCanvas.prototype._setImageInfo = function(imageInfo) {
        if (this.imageCanvas) {
            this.view.removeLayer(this.imageCanvas);
            this.imageCanvas = null;
        }
        var options = FractalView.getDimensions(imageInfo.width,
                imageInfo.height);
        options.url = imageInfo.url;
        options.reloadTiles = true;
        this.imageCanvas = new DeepZoomCanvas(options);
        this.view.addLayer(this.imageCanvas);
        var e = $(this.options.element);
        this.view.fitView(e.width(), e.height(), imageInfo.width,
                imageInfo.height);
    }

    /**
     * This method is called to update marker styles when the zoom level is
     * changed
     */
    ImageCanvas.prototype._updateMarker = function(marker) {
        var viewZoom = this.view.getZoom();
        var markerZoom = marker._annotation.zoom;
        var className = "zoom";
        if (viewZoom != undefined && markerZoom != undefined) {
            var level = viewZoom - markerZoom;
            if (level != 0) {
                var prefix = level > 0 ? " zoom-in" : " zoom-out";
                className += prefix;
                for ( var i = 1; i < level; i++) {
                    className += prefix + "-prev-" + i;
                }
                className += prefix + "-" + Math.abs(level);
            }
        }
        // marker._icon.className = className;
        console.log("Marker zoom classes: " + className)
    }

    /** Creates and returns a new marker for the specified annotation. */
    ImageCanvas.prototype._newMarker = function(annotation) {
        var type = annotation.markerType || "icon-tag";
        var title = annotation.title ? "<span class='umx-title'>"
                + annotation.title + "</span>" : "";
        var icon = new L.DivIcon({
            iconSize : new L.Point(18, null),
            iconAnchor : new L.Point(9, 9),
            popupAnchor : new L.Point(0, 0),
            className : "umx-marker umx-shadow",
            html : "<div><i class='icon " + type + "'></i>" + title + "</div>"
        });
        var marker = L.marker(annotation.topLeft, {
            icon : icon
        });
        var content = $(annotation.content).get(0);
        marker.bindPopup(content, {
            maxWidth : 500,
            minWidth : 300,
            maxHeight : 300
        });
        marker.on("click", function() {
            marker.openPopup();
        })
        marker._annotation = annotation;
        return marker;
    }

    /** An internal method binding annotations to the image */
    ImageCanvas.prototype._setImageAnnotations = function(imageAnnotations) {
        if (this.imageAnnotations) {
            this.imageAnnotations = null;
        }
        this.imageAnnotations = imageAnnotations;
        if (this.markerGroup) {
            this.view.removeLayer(this.markerGroup);
            this.markerGroup = null;
        }
        this.markerGroup = new L.LayerGroup();
        this.view.addLayer(this.markerGroup);

        for ( var i = 0; i < this.imageAnnotations.length; i++) {
            var annotation = this.imageAnnotations[i];
            var marker = this._newMarker(annotation);
            this.markerGroup.addLayer(marker);
        }
        this._onViewReset();
    }

    /** Adds highlighted zones to the image. */
    ImageCanvas.prototype._setImageHighlights = function(imageHighlights) {
        if (imageHighlights) {
            // TODO: remove an already existing highlights
            this.highlighter = new AreaHighlighter(this.view,
                    imageHighlights.areas);
            var controlContent = $(imageHighlights.content);
            var NavigationControl = L.Control.extend({
                options : {
                    position : 'bottomleft'
                },
                onAdd : function(map) {
                    return controlContent.get(0);
                }
            });
            this.view.addControl(new NavigationControl());
            this.highlighter.show();
        }
    }

    /** Sets a new image */
    ImageCanvas.prototype.setImage = function(options) {
        this._setImageInfo(options.image);
        this._setImageAnnotations(options.annotations);
        this._setImageHighlights(options.highlights);
    }

    /** Focus on a highlighted zone with the specified identifier */
    ImageCanvas.prototype.focusOnZone = function(idx) {
        if (!this.highlighter)
            return;
        this.highlighter.activateArea(idx);
    }

    /** Initializes a debug information with this image canvas. */
    ImageCanvas.prototype.initDebug = function(options) {
        if (!options.debug)
            return;
        var popup = L.popup();
        var view = this.view;
        view.on('click', function(e) {
            popup.setLatLng(e.latlng).setContent(
                    "<strong>" + e.latlng.lat + ";" + e.latlng.lng
                            + "</strong>").openOn(view);
        });
        var grid = new DebugGridLayer();
        view.addLayer(grid);
    }

    /* --------------------------------------------------------------------- */
    /**
     * Extracts and returns an image configuration from parameters of the
     * specified jQuery article object.
     */
    function getImageConfig(article) {
        var urlMask = article.attr("data-image-url");
        var width = article.attr("data-image-width");
        var height = article.attr("data-image-height");
        var zoom = article.attr("data-image-zoom") || "10";
        return {
            url : urlMask,
            width : width,
            height : height,
            zoom : zoom
        };
    }

    /**
     * An utility method allowing to extract latitude/longitude from the
     * specified attribute of the given element
     */
    function getLatLng(e, attr) {
        var s = e.attr(attr);
        if (!s)
            return null;
        var array = s.split(/;/);
        var point = L.latLng(array);
        return point;
    }

    /** Extract basic geographic information from the specified elemnet */
    function extractGeoInfo(section) {
        section = $(section);
        var topLeft = getLatLng(section, "data-top-left");
        if (!topLeft)
            return null;
        var bottomRight = getLatLng(section, "data-bottom-right");
        bottomRight = bottomRight
                || L.latLng(topLeft.lat + 0.01, topLeft.lng + 0.01);
        var zoom = section.attr("data-zoom") || 12;
        return {
            topLeft : topLeft,
            bottomRight : bottomRight,
            zoom : zoom
        };
    }

    /** Returns an individual annotation extracted from the specified section tag */
    function getImageAnnotation(section) {
        var markerType = section.attr("data-marker-icon") || "icon-tag";
        var title = section.attr("data-title") || section.find("h1").html();
        var info = extractGeoInfo(section);
        if (info) {
            info.content = section;
            info.title = title;
        }
        return info;
    }

    /** Returns annotations extracted from the specified article tag */
    function getImageAnnotations(article) {
        var result = [];
        $(article).find("section").each(function() {
            var section = $(this);
            var annotation = getImageAnnotation(section);
            if (annotation) {
                result.push(annotation);
            }
        })
        return result;
    }

    /** Returns highlighted zones defined in the article tag */
    function getImageHighlights(article, callback) {
        var list = article.find(".area-annotations");
        list.css({
            zIndex : 10000
        });
        var areas = [];
        var result = {
            areas : areas,
            content : list
        };
        list.find("li a").each(function(pos, element) {
            var item = $(element);
            var info = extractGeoInfo(item);
            if (!info)
                return;
            info.color = item.attr("data-zone-color");
            var idx = areas.length;
            var onClick = function(event) {
                callback.call(info, idx);
                $.Event(event).stopPropagation();
                return false;
            };
            item.click(onClick);
            info.onClick = onClick;
            areas.push(info);
        });
        return result;
    }

    /**
     * Extracts an article from the specified HTML code and returns a jQuery
     * object representing this article.
     */
    function getArticle(str) {
        var prefix = "<article";
        var suffix = "</article>";
        var idx = str.indexOf(prefix);
        if (idx > 0) {
            str = str.substring(idx);
        }
        idx = str.indexOf(suffix);
        if (idx > 0) {
            str = str.substring(0, idx + suffix.length);
        }
        return $(str);
    }

    /**
     * Shows the content of the specified article on the screen around an image
     * defined in the article parameters.
     */
    function showArticleContent(canvas, article) {
        var imageInfo = getImageConfig(article);
        var imageAnnotations = getImageAnnotations(article);
        var imageHighlights = getImageHighlights(article, function(idx) {
            canvas.focusOnZone(idx);
        });
        canvas.setImage({
            image : imageInfo,
            annotations : imageAnnotations,
            highlights : imageHighlights
        });
    }

    /**
     * Asynchronously loads and puts on the screen the information loaded from
     * the specified HTML file.
     */
    function loadContent(canvas, href) {
        $.ajax({
            url : href,
            success : function(result) {
                var article = getArticle(result + "");
                showArticleContent(canvas, article);
            },
            async : true
        });
    }
    showArticleContent

    /** Main function activating the screen */
    $(document).ready(function() {
        var canvas = new ImageCanvas({
            debug : true,
            element : $("#main-canvas"),
            zoom : 11,
            maxZoom : 16,
            minZoom : 8
        });
        var mainArticle = $("article");
        showArticleContent(canvas, mainArticle);
        $("#navigation-bottom a").each(function(pos, e) {
            e = $(e);
            var href = e.attr("href");
            $(e).click(function(event) {
                loadContent(canvas, href);
                event.stopPropagation();
                return false;
            });
        });
    })

})();
