/* @flow */

import React, { Component } from "react";

import ChoroplethMap from "../components/ChoroplethMap.jsx";
import PinMap from "../components/PinMap.jsx";

import { ChartSettingsError } from "metabase/visualizations/lib/errors";
import { isNumeric, isLatitude, isLongitude, hasLatitudeAndLongitudeColumns } from "metabase/lib/schema_metadata";
import { metricSetting, dimensionSetting, fieldSetting } from "metabase/visualizations/lib/settings";
import MetabaseSettings from "metabase/lib/settings";

import { isSameSeries } from "metabase/visualizations/lib/utils";

import type { VisualizationProps } from "metabase/meta/types/Visualization";

import _ from "underscore";

const PIN_MAP_TYPES = new Set(["pin", "heat", "grid"]);

export default class Map extends Component {
    static uiName = "Map";
    static identifier = "map";
    static iconName = "pinmap";

    static aliases = ["state", "country", "pin_map"];

    static minSize = { width: 4, height: 4 };

    static isSensible(cols, rows) {
        return true;
    }

    static settings = {
        "map.type": {
            title: "Map type",
            widget: "select",
            props: {
                options: [
                    { name: "Region map", value: "region" },
                    { name: "Pin map", value: "pin" },
                    { name: "Heat map", value: "heat" },
                    { name: "Grid map", value: "grid" }
                ]
            },
            getDefault: ([{ card, data: { cols } }], settings) => {
                switch (card.display) {
                    case "state":
                    case "country":
                        return "region";
                    case "pin_map":
                        return "pin";
                    default:
                        if (hasLatitudeAndLongitudeColumns(cols)) {
                            const latitudeColumn = _.findWhere(cols, { name: settings["map.latitude_column"] });
                            const longitudeColumn = _.findWhere(cols, { name: settings["map.longitude_column"] });
                            if (latitudeColumn && longitudeColumn && latitudeColumn.binning_info && longitudeColumn.binning_info) {
                                // lat/lon columns are binned, use grid by default
                                return "grid";
                            } else if (settings["map.metric_column"]) {
                                //
                                return "heat";
                            } else {
                                return "pin";
                            }
                        } else {
                            return "region";
                        }
                }
            },
            readDependencies: ["map.latitude_column", "map.longitude_column", "map.metric_column"]
        },
        "map.pin_type": {
            title: "Pin type",
            // Don't expose this in the UI for now
            // widget: "select",
            props: {
                options: [
                    { name: "Tiles", value: "tiles" },
                    { name: "Markers", value: "markers" },
                    { name: "Heat", value: "heat" },
                    { name: "Grid", value: "grid" }
                ]
            },
            getDefault: (series, vizSettings) =>
                vizSettings["map.type"] === "heat" ?
                    "heat"
                : vizSettings["map.type"] === "grid" ?
                    "grid"
                : series[0].data.rows.length >= 1000 ?
                    "tiles"
                :
                    "markers",
            getHidden: (series, vizSettings) => !PIN_MAP_TYPES.has(vizSettings["map.type"])
        },
        "map.latitude_column": {
            title: "Latitude field",
            ...fieldSetting("map.latitude_column", isNumeric,
                ([{ data: { cols }}]) => (_.find(cols, isLatitude) || {}).name),
            getHidden: (series, vizSettings) => !PIN_MAP_TYPES.has(vizSettings["map.type"])
        },
        "map.longitude_column": {
            title: "Longitude field",
            ...fieldSetting("map.longitude_column", isNumeric,
                ([{ data: { cols }}]) => (_.find(cols, isLongitude) || {}).name),
            getHidden: (series, vizSettings) => !PIN_MAP_TYPES.has(vizSettings["map.type"])
        },
        "map.metric_column": {
            title: "Metric field",
            ...metricSetting("map.metric_column"),
            getHidden: (series, vizSettings) =>
                !PIN_MAP_TYPES.has(vizSettings["map.type"]) || (
                    (vizSettings["map.pin_type"] !== "heat" && vizSettings["map.pin_type"] !== "grid")
                ),
        },
        "map.region": {
            title: "Region map",
            widget: "select",
            getDefault: ([{ card, data: { cols }}]) => {
                switch (card.display) {
                    case "country":
                        return "world_countries";
                    case "state":
                    default:
                        return "us_states";
                }
            },
            getProps: () => ({
                // $FlowFixMe:
                options: Object.entries(MetabaseSettings.get("custom_geojson", {})).map(([key, value]) => ({ name: value.name, value: key }))
            }),
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "region"
        },
        "map.metric": {
            title: "Metric field",
            ...metricSetting("map.metric"),
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "region"
        },
        "map.dimension": {
            title: "Region field",
            widget: "select",
            ...dimensionSetting("map.dimension"),
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "region"
        },
        "map.zoom": {
        },
        "map.center_latitude": {
        },
        "map.center_longitude": {
        },
        "map.heat.radius": {
            title: "Radius",
            widget: "number",
            default: 30,
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "heat"
        },
        "map.heat.blur": {
            title: "Blur",
            widget: "number",
            default: 60,
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "heat"
        },
        "map.heat.min-opacity": {
            title: "Min Opacity",
            widget: "number",
            default: 0,
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "heat"
        },
        "map.heat.max-zoom": {
            title: "Max Zoom",
            widget: "number",
            default: 1,
            getHidden: (series, vizSettings) => vizSettings["map.type"] !== "heat"
        },
    }

    static checkRenderable([{ data: { cols, rows} }], settings) {
        if (PIN_MAP_TYPES.has(settings["map.type"])) {
            if (!settings["map.longitude_column"] || !settings["map.latitude_column"]) {
                throw new ChartSettingsError("Please select longitude and latitude columns in the chart settings.", "Data");
            }
        } else if (settings["map.type"] === "region"){
            if (!settings["map.dimension"] || !settings["map.metric"]) {
                throw new ChartSettingsError("Please select region and metric columns in the chart settings.", "Data");
            }
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        let sameSize = (this.props.width === nextProps.width && this.props.height === nextProps.height);
        let sameSeries = isSameSeries(this.props.series, nextProps.series);
        return !(sameSize && sameSeries);
    }

    render() {
        const { settings } = this.props;
        const type = settings["map.type"];
        if (PIN_MAP_TYPES.has(type)) {
            return <PinMap {...this.props} />
        } else if (type === "region") {
            return <ChoroplethMap {...this.props} />
        }
    }
}
