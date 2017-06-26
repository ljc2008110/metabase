import LeafletMap from "./LeafletMap.jsx";

import L from "leaflet";
import "leaflet.heat";

export default class LeafletHeatMap extends LeafletMap {
    componentDidMount() {
        super.componentDidMount();

        this.pinMarkerLayer = L.layerGroup([]).addTo(this.map);
        this.heatLayer = L.heatLayer([], { radius: 25 }).addTo(this.map);
        this.componentDidUpdate({}, {});
    }

    componentDidUpdate(prevProps, prevState) {
        super.componentDidUpdate(prevProps, prevState);

        try {
            const { heatLayer } = this;
            const { points, max, settings } = this.props;

            heatLayer.setOptions({
                max: max,
                maxZoom: settings["map.heat.max-zoom"],
                minOpacity: settings["map.heat.min-opacity"],
                radius:  settings["map.heat.radius"],
                blur: settings["map.heat.blur"],
            });
            heatLayer.setLatLngs(points);
        } catch (err) {
            console.error(err);
            this.props.onRenderError(err.message || err);
        }
    }
}
