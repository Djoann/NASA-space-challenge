(function(context) {
    context.AreaHighlighter = AreaHighlighter;

    function play(actions, pos) {
        pos = pos || 0;
        if (pos >= 0 && pos < actions.length) {
            var that = this;
            var action = actions[pos].action;
            var timeout = actions[pos].timeout;
            var f = function() {
                action();
                play(actions, pos + 1);
            };
            if (timeout && timeout > 0) {
                setTimeout(f, timeout);
            } else {
                f();
            }
        }
    }

    function AreaHighlighter(view, areas) {
        this.view = view;
        this.topBounds = this.view.getBounds();
        this.areas = areas || [];
    }
    AreaHighlighter.prototype.hide = function() {
        if (this.group) {
            this.view.removeLayer(this.group);
            this.group = null;
        }
    }
    AreaHighlighter.prototype.show = function() {
        this.hide();
        var array = [];
        for ( var i = 0; i < this.areas.length; i++) {
            var area = this.areas[i];
            if (!area.bounds) {
                var topLeft = L.latLng(area.topLeft);
                var bottomRight = L.latLng(area.bottomRight);
                area.bounds = L.latLngBounds(topLeft, bottomRight);
            }
            var rect = L.rectangle(area.bounds, {
                color : area.color,
                stroke : false,
                fill : true,
                weight : 1
            });
            if (area.onClick) {
                rect.on("click", area.onClick, area);
            }
            if (area.onMouseOver) {
                rect.on("mouseover", area.onMouseOver, area);
            }
            array.push(rect);
        }
        this.group = new L.FeatureGroup(array);
        this.view.addLayer(this.group);
    }

    AreaHighlighter.prototype.size = function() {
        return this.areas.length;
    }

    AreaHighlighter.prototype.activateArea = function(index) {
        if (index >= 0 && index <= this.areas.length) {
            var that = this;
            var area = that.areas[index];
            var actions = [];
            if (that.prevArea) {
                var b = that.prevArea.bounds;
                b = this.view.getBounds();
                var bounds = new L.LatLngBounds(b.getSouthWest(), b
                        .getNorthEast());
                var newBounds = new L.LatLngBounds(area.bounds.getSouthWest(),
                        area.bounds.getNorthEast());
                bounds.extend(newBounds);
                actions.push({
                    action : function() {
                        that.view.fitBounds(bounds);
                    }
                });
            }
            that.prevArea = area;
            actions.push({
                timeout : 600,
                action : function() {
                    var center = area.bounds.getCenter();
                    that.view.panTo(center);
                }
            });
            actions.push({
                timeout : 600,
                action : function() {
                    var area = that.areas[index];
                    that.view.fitBounds(area.bounds);
                }
            });
            play(actions, 0);
        }
    }
})(this);