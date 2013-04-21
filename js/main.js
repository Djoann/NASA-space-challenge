(function() {

    /** Creates and return a new Bootstrap-based popup modal window */
    function newPopup(options) {
        var html = [];
        html.push('<div class="modal hide fade" tabindex="-1"');
        html.push('role="dialog" aria-hidden="true">');
        html.push('<div class="modal-header">');
        html.push('<button type="button" class="close" ');
        html.push('data-dismiss="modal" aria-hidden="true">×</button>');
        html.push('<h3 class="title">Modal header</h3>');
        html.push('</div>');
        html.push('<div class="modal-body">');
        html.push('<p>One fine body…</p>');
        html.push('</div>');
        html.push('</div>');
        var popup = $(html.join(""));
        var title = options.title;
        var content = options.content;
        if (!title || "" == title) {
            title = $(content).find("h1").remove();
        }
        if (options.noFade) {
            popup.removeClass("fade");
        }
        popup.find(".modal-body").html("").append(content);
        popup.find(".title").html("").append(title);
        return popup.modal(options)
    }

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
        var element = this.view._container;
        var viewZoom = this.view.getZoom();
        var markerZoom = this.options.annotationZoom || 12;
        
        var className = "zoom";
        if (viewZoom != undefined && markerZoom != undefined) {
            var level = viewZoom - markerZoom;
            if (level != 0) {
                var prefix = level > 0 ? " zoom-in" : " zoom-out";
                level = Math.abs(level);
                className += prefix;
                for ( var i = 1; i < level; i++) {
                    className += prefix + "-prev-" + i;
                }
                className += prefix + "-" + level;
            }
        }
        var oldClassName = element.className;
        oldClassName = oldClassName.replace(/\zoom-(in|out)(-prev)?(-\d)?\b/g, '');
        oldClassName = oldClassName.replace(/\zoom\b/g, '');
        oldClassName = oldClassName.replace(/\s+/g, ' ');
        if (oldClassName != "") {
            oldClassName += " ";
        }
        element.className = oldClassName + className;
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
        marker._icon.className = oldClassName + " " + className;
        // console.log("Marker zoom classes: " + className)
    }

    /** Creates and returns a new popup window with the specified content */
    ImageCanvas.prototype._newPopup = newPopup;

    /** Creates and returns a new marker for the specified annotation. */
    ImageCanvas.prototype._newMarker = function(annotation) {
        var type = annotation.markerType;
        if (type && "" != type) {
            type = "<i class='icon " + type + "'></i>";
        } else {
            type = "";
        }
        var title = annotation.title ? 
                annotation.title  : "";
        var icon = new L.DivIcon({
            iconSize : new L.Point(18, null),
            iconAnchor : new L.Point(9, 9),
            popupAnchor : new L.Point(0, 0),
            className : "",
            html : "<span class='umx-marker-title'>" + type + title + "</span>"
        });
        var marker = L.marker(annotation.topLeft, {
            icon : icon
        });

        var popup = this._newPopup({
            title : annotation.title,
            content : annotation.content,
            show : false,
            backdrop : true,
            keyboard : true
        });
        marker.on("click", function() {
            popup.modal("show");
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
        var markerType = section.attr("data-marker-icon");
        var title = section.attr("data-title") || section.find("h1").html();
        var info = extractGeoInfo(section);
        if (info) {
            info.content = section;
            info.title = title;
            info.markerType = markerType;
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
    function loadContent(canvas, href, callback) {
        var that = this;
        $.ajax({
            url : href,
            success : function(result) {
                var article = getArticle(result + "");
                showArticleContent(canvas, article);
                if (callback) {
                    callback.call(that);
                }
            },
            async : true
        });
    }
    showArticleContent

    /** Main function activating the screen */
    $(document).ready(function() {
        var mainCanvas = $("#main-canvas");
        var canvas = new ImageCanvas({
// debug : true,
            element : mainCanvas,
            zoom : 11,
            maxZoom : 16,
            minZoom : 8
        });
        var url = mainCanvas.attr("data-content-url");

        var loadingPopup = newPopup({
            title : "Loading...",
            content : "Loading all data...",
            show : false,
            backdrop : false,
            keyboard : false,
            noFade : true
        });
        loadingPopup.modal("show");
        // setTimeout(function() {
        loadContent(canvas, url, function() {
            loadingPopup.modal("hide");
        });
        // }, 100);
    })

})();
