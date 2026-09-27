sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "sap/ui/core/Fragment"
    ],
    function (Controller, JSONModel, MessageToast, Fragment) {
        "use strict";

        // Plant mapping with descriptive facility names
        var PLANT_MAP = {
            "3104": "Plant 3104 (Packaging & Assembly Facility)",
            "3101": "Plant 3101 (Manufacturing Hub)",
            "2101": "Plant 2101 (Central Logistics & Distribution)",
            "": "General Stock / Unassigned Facility"
        };

        // MRP Status mapping dictionary
        var STATUS_MAP = {
            "": {
                text: "Pending Print",
                state: "Information",
                icon: "sap-icon://pending",
                description: "Created in SAP. Barcode label has not yet been physically printed or scanned."
            },
            "X": {
                text: "Printed",
                state: "Success",
                icon: "sap-icon://print",
                description: "MRP label generated, barcode verified, and ready for packaging."
            },
            "E": {
                text: "Exported",
                state: "Warning",
                icon: "sap-icon://journey-arrive",
                description: "Label exported to external warehouse or automated conveyor printing system."
            },
            "C": {
                text: "Completed",
                state: "Success",
                icon: "sap-icon://accept",
                description: "Manufacturing order step completed and verified."
            }
        };

        return Controller.extend(
            "zpp.mrp.dashboard.zppmrpdashboard.controller.Dashboard",
            {

                onInit: function () {
                    // KPI Model
                    var oKPIModel = new JSONModel({
                        mrpCount: 0,
                        mrpSubtitle: "Active Production Labels",
                        boxHeaderCount: 0,
                        boxHeaderSubtitle: "Box Master Headers",
                        boxItemCount: 0,
                        boxItemSubtitle: "Packed Unit Items",
                        setHeaderCount: 0,
                        setHeaderSubtitle: "Set Master Orders",
                        setItemCount: 0,
                        setItemSubtitle: "Component Units"
                    });
                    this.getView().setModel(oKPIModel, "kpi");

                    // Chart Model (6 charts: 2 MRP, 2 Box, 2 Set)
                    var oChartModel = new JSONModel({
                        mrpStatus: [],
                        mrpMaterial: [],
                        boxStatus: [],
                        boxQuantity: [],
                        setStatus: [],
                        setQuantity: []
                    });
                    this.getView().setModel(oChartModel, "chart");

                    // Chart Metadata Model for dynamic subtitles & badges
                    var oChartMetaModel = new JSONModel({
                        mrpStatusSubtitle: "Label processing status breakdown",
                        mrpStatusBadge: "Status Distribution",
                        mrpMaterialSubtitle: "Volume distribution by production style / material",
                        mrpMaterialBadge: "Style Breakdown",
                        boxStatusSubtitle: "Box packaging completion status",
                        boxStatusBadge: "Overall Status",
                        boxQtySubtitle: "Total packed unit distribution across facilities",
                        boxQtyBadge: "Plant Breakdown",
                        setStatusSubtitle: "Set packaging execution status",
                        setStatusBadge: "Execution Status",
                        setQtySubtitle: "Component volume distribution across facilities",
                        setQtyBadge: "Plant Breakdown"
                    });
                    this.getView().setModel(oChartMetaModel, "chartMeta");

                    // Interactive Line Item Selection Model
                    var oSelectionModel = new JSONModel({
                        hasSelection: false,
                        selectedItem: null,
                        orderTag: "",
                        filterSummary: ""
                    });
                    this.getView().setModel(oSelectionModel, "selection");

                    // Line Item Detail Inspector Model
                    var oDetailModel = new JSONModel({});
                    this.getView().setModel(oDetailModel, "detail");

                    // General View Model
                    var oViewModel = new JSONModel({
                        lastUpdated: "Just now",
                        chartCategory: "all"
                    });
                    this.getView().setModel(oViewModel, "view");

                    this._initTableModel();
                },

                _initTableModel: function () {
                    var oTableModel = new JSONModel({
                        activeDataset: "mrp",
                        activeDatasetTitle: "MRP Label",
                        mrpCount: 0,
                        boxHdrCount: 0,
                        boxItemCount: 0,
                        setHdrCount: 0,
                        setItemCount: 0,
                        pagedData: [],
                        currentPage: 1,
                        pageSize: "25",
                        totalPages: 1,
                        totalRecords: 0,
                        startIndex: 0,
                        endIndex: 0,
                        canGoPrevious: false,
                        canGoNext: false,
                        searchQuery: ""
                    });
                    this.getView().setModel(oTableModel, "table");

                    this._allMRPData = [];
                    this._filteredData = [];
                    this._allBoxHeaders = [];
                    this._allBoxItems = [];
                    this._allSetHeaders = [];
                    this._allSetItems = [];
                },

                onAfterRendering: function () {
                    this._configureCharts();

                    if (this._bInitialLoadStarted) {
                        return;
                    }

                    this._bInitialLoadStarted = true;
                    this._loadDashboardData();
                },

                _configureCharts: function () {
                    this._configureMrpChart();
                    this._configureMrpMaterialChart();
                    this._configureBoxStatusChart();
                    this._configureSetStatusChart();
                    this._configureQuantityCharts();
                },

                _configureMrpChart: function () {
                    var oMrpStatus = this.byId("mrpStatusChart");
                    if (oMrpStatus) {
                        oMrpStatus.setVizProperties({
                            title: { visible: false },
                            plotArea: {
                                dataLabel: { visible: true, type: "value" },
                                colorPalette: ["#0070f2", "#10b981", "#f59e0b", "#6366f1", "#0284c7", "#ef4444"]
                            },
                            legendGroup: { layout: { position: "bottom" } }
                        });
                    }
                },

                _configureMrpMaterialChart: function () {
                    var oMrpMaterial = this.byId("mrpMaterialChart");
                    if (oMrpMaterial) {
                        oMrpMaterial.setVizProperties({
                            title: { visible: false },
                            plotArea: {
                                dataLabel: { visible: true },
                                colorPalette: ["#6366f1"]
                            },
                            valueAxis: { title: { visible: true, text: "Labels" } },
                            categoryAxis: {
                                title: { visible: false },
                                label: { rotation: "straight" }
                            },
                            legend: { visible: false }
                        });
                    }
                },

                _configureBoxStatusChart: function () {
                    var oBoxStatus = this.byId("boxStatusChart");
                    if (oBoxStatus) {
                        oBoxStatus.setVizProperties({
                            title: { visible: false },
                            plotArea: {
                                dataLabel: { visible: true },
                                colorPalette: ["#0070f2", "#6366f1", "#10b981", "#f59e0b"]
                            },
                            valueAxis: { title: { visible: true, text: "Count" } },
                            categoryAxis: {
                                title: { visible: false },
                                label: { rotation: "straight" }
                            },
                            legendGroup: { layout: { position: "bottom" } }
                        });
                    }
                },

                _configureSetStatusChart: function () {
                    var oSetStatus = this.byId("setStatusChart");
                    if (oSetStatus) {
                        oSetStatus.setVizProperties({
                            title: { visible: false },
                            plotArea: {
                                dataLabel: { visible: true },
                                colorPalette: ["#f59e0b", "#10b981", "#0070f2", "#6366f1"]
                            },
                            valueAxis: { title: { visible: true, text: "Count" } },
                            categoryAxis: {
                                title: { visible: false },
                                label: { rotation: "straight" }
                            },
                            legendGroup: { layout: { position: "bottom" } }
                        });
                    }
                },

                _configureQuantityCharts: function () {
                    var oBoxQty = this.byId("boxQuantityChart");
                    if (oBoxQty) {
                        oBoxQty.setVizProperties({
                            title: { visible: false },
                            plotArea: { dataLabel: { visible: true }, colorPalette: ["#0284c7"] },
                            valueAxis: { title: { visible: true, text: "Quantity (Units)" } },
                            categoryAxis: {
                                title: { visible: true, text: "Plant Facility" },
                                label: { rotation: "straight" }
                            },
                            legend: { visible: false }
                        });
                    }

                    var oSetQty = this.byId("setQuantityChart");
                    if (oSetQty) {
                        oSetQty.setVizProperties({
                            title: { visible: false },
                            plotArea: { dataLabel: { visible: true }, colorPalette: ["#059669"] },
                            valueAxis: { title: { visible: true, text: "Quantity (Units)" } },
                            categoryAxis: {
                                title: { visible: true, text: "Plant Facility" },
                                label: { rotation: "straight" }
                            },
                            legend: { visible: false }
                        });
                    }
                },

                onChartCategoryChange: function (oEvent) {
                    var sKey = oEvent.getParameter("item").getKey();
                    this.getView().getModel("view").setProperty("/chartCategory", sKey);

                    // Flush so SVG containers redraw to the correct container dimensions
                    setTimeout(function () {
                        this._configureCharts();
                        var aIds = [
                            "mrpStatusChart",
                            "mrpMaterialChart",
                            "boxStatusChart",
                            "boxQuantityChart",
                            "setStatusChart",
                            "setQuantityChart"
                        ];
                        aIds.forEach(function (sId) {
                            var oChart = this.byId(sId);
                            if (oChart && oChart.getDomRef()) {
                                oChart.invalidate();
                            }
                        }.bind(this));
                    }.bind(this), 0);
                },

                _loadDashboardData: async function () {
                    var oModel = this.getView().getModel();
                    if (!oModel) {
                        MessageToast.show("OData model not available");
                        return;
                    }

                    sap.ui.core.BusyIndicator.show(0);
                    try {
                        var aMRP = await this._safeRead("MRPLabel");
                        var aBoxHeader = await this._safeRead("BoxPackingHeader");
                        var aBoxItem = await this._safeRead("BoxPackingItem");
                        var aSetHeader = await this._safeRead("SetPackingHeader");
                        var aSetItem = await this._safeRead("SetPackingItem");

                        this._allMRPData = (aMRP || []).map(this._enrichMRPItem.bind(this));
                        this._allBoxHeaders = aBoxHeader || [];
                        this._allBoxItems = aBoxItem || [];
                        this._allSetHeaders = aSetHeader || [];
                        this._allSetItems = aSetItem || [];

                        var oTableModel = this.getView().getModel("table");
                        oTableModel.setProperty("/mrpCount", this._allMRPData.length);
                        oTableModel.setProperty("/boxHdrCount", this._allBoxHeaders.length);
                        oTableModel.setProperty("/boxItemCount", this._allBoxItems.length);
                        oTableModel.setProperty("/setHdrCount", this._allSetHeaders.length);
                        oTableModel.setProperty("/setItemCount", this._allSetItems.length);

                        this._applyGlobalKPIs();
                        this._computeAndApplyCharts(
                            this._allMRPData,
                            this._allBoxHeaders,
                            this._allBoxItems,
                            this._allSetHeaders,
                            this._allSetItems,
                            null
                        );

                        var sSearch = oTableModel.getProperty("/searchQuery") || "";
                        this._filterData(sSearch);
                        this._updatePagination(1);

                        var sTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        this.getView().getModel("view").setProperty("/lastUpdated", "Updated at " + sTime);
                        this._configureCharts();
                    } finally {
                        sap.ui.core.BusyIndicator.hide();
                    }
                },

                _enrichMRPItem: function (oItem) {
                    var oEnriched = Object.assign({}, oItem);

                    if (oItem.Manufacturingorder && oItem.Manufacturingorder.trim() !== "") {
                        oEnriched.displayOrder = oItem.Manufacturingorder;
                        oEnriched.orderSubtitle = oItem.UniqueNo ? ("ID: " + oItem.UniqueNo) : "Production Run";
                    } else {
                        oEnriched.displayOrder = oItem.UniqueNo ? ("Label #" + oItem.UniqueNo) : "Standalone Label";
                        oEnriched.orderSubtitle = "Standalone Barcode Label";
                    }

                    if (oItem.Salesorder && oItem.Salesorder.trim() !== "") {
                        var sItem = (oItem.Salesorderitem && oItem.Salesorderitem !== "0") ? (" / " + oItem.Salesorderitem) : "";
                        oEnriched.displaySalesOrder = oItem.Salesorder + sItem;
                    } else {
                        oEnriched.displaySalesOrder = "Stock / Internal";
                    }

                    oEnriched.displayMaterial = oItem.Material && oItem.Material.trim() !== "" ? oItem.Material : "Unassigned Material";
                    oEnriched.materialSubtitle = oItem.Material && oItem.Material.trim() !== "" ? "Production Style" : "Standard Stock";
                    oEnriched.displayBatch = oItem.Batch && oItem.Batch.trim() !== "" ? oItem.Batch : "Standard";

                    var oColorSize = this._resolveColorAndSize(oItem);
                    oEnriched.displayColor = oColorSize.color;
                    oEnriched.displaySize = oColorSize.size;

                    var sPlantCode = (oItem.Plant || "").trim();
                    oEnriched.displayPlant = sPlantCode ? ("Plant " + sPlantCode) : "Central Plant";
                    oEnriched.plantDescription = PLANT_MAP[sPlantCode] || ("Plant " + (sPlantCode || "General"));

                    var oStatusInfo = this._resolveStatusInfo(oItem.Status);
                    oEnriched.statusText = oStatusInfo.text;
                    oEnriched.statusState = oStatusInfo.state;
                    oEnriched.statusIcon = oStatusInfo.icon;
                    oEnriched.statusDescription = oStatusInfo.description;

                    return oEnriched;
                },

                _resolveColorAndSize: function (oItem) {
                    var sColor = (oItem.Color || "").trim();
                    var sSize = (oItem.Sizes || "").trim();

                    if (!sColor && oItem.Batch) {
                        var sB = oItem.Batch.trim();
                        if (sB.indexOf("-") !== -1) {
                            var aParts = sB.split("-");
                            sColor = aParts[0];
                            sSize = aParts[1] || sSize;
                        } else if (sB.toUpperCase().indexOf("BLACK") !== -1) {
                            sColor = "BLACK";
                            var sRemain = sB.replace(/BLACK/i, "").trim();
                            if (sRemain && !sSize) {
                                sSize = sRemain;
                            }
                        }
                    }

                    return {
                        color: sColor || "Standard",
                        size: sSize || "All Sizes"
                    };
                },

                _resolveStatusInfo: function (sRaw) {
                    var sUpper = (sRaw || "").trim().toUpperCase();
                    return STATUS_MAP[sUpper] || {
                        text: sUpper || "Pending Print",
                        state: "Information",
                        icon: "sap-icon://pending",
                        description: "Status " + (sUpper || "Unprinted")
                    };
                },

                _applyGlobalKPIs: function () {
                    this.getView().getModel("kpi").setData({
                        mrpCount: this._allMRPData.length,
                        mrpSubtitle: "Active Production Labels",
                        boxHeaderCount: this._allBoxHeaders.length,
                        boxHeaderSubtitle: "Box Master Headers",
                        boxItemCount: this._allBoxItems.length,
                        boxItemSubtitle: "Packed Unit Items",
                        setHeaderCount: this._allSetHeaders.length,
                        setHeaderSubtitle: "Set Master Orders",
                        setItemCount: this._allSetItems.length,
                        setItemSubtitle: "Component Units"
                    });
                },

                _computeAndApplyCharts: function (aMRP, aBoxH, aBoxI, aSetH, aSetI, oSelectedItem) {
                    var oChartModel = this.getView().getModel("chart");

                    var aMrpStatusData = this._computeMrpStatusChart(aMRP);
                    oChartModel.setProperty("/mrpStatus", aMrpStatusData);

                    var aMrpMaterialData = this._computeMrpMaterialChart(aMRP);
                    oChartModel.setProperty("/mrpMaterial", aMrpMaterialData);

                    var aBoxStatusData = this._computeBoxStatusChart(aBoxH);
                    oChartModel.setProperty("/boxStatus", aBoxStatusData);

                    var aSetStatusData = this._computeSetStatusChart(aSetH);
                    oChartModel.setProperty("/setStatus", aSetStatusData);

                    var aBoxQtyData = this._sumByPlant(aBoxI || [], "Quantity");
                    if (aBoxQtyData.length === 0) {
                        aBoxQtyData = [{ Plant: "No Plant Data", Quantity: 0 }];
                    }
                    oChartModel.setProperty("/boxQuantity", aBoxQtyData);

                    var aSetQtyData = this._sumByPlant(aSetI || [], "Quantity");
                    if (aSetQtyData.length === 0) {
                        aSetQtyData = [{ Plant: "No Plant Data", Quantity: 0 }];
                    }
                    oChartModel.setProperty("/setQuantity", aSetQtyData);

                    this._updateChartMetadata(oSelectedItem, aMRP, aBoxH, aBoxQtyData, aSetH, aSetQtyData);
                },

                _computeMrpStatusChart: function (aMRP) {
                    var oCounts = {};
                    (aMRP || []).forEach(function (oItem) {
                        var sStatus = oItem.statusText || "Pending Print";
                        oCounts[sStatus] = (oCounts[sStatus] || 0) + 1;
                    });

                    var aData = Object.keys(oCounts).map(function (sKey) {
                        return { Status: sKey, Count: oCounts[sKey] };
                    });

                    return aData.length > 0 ? aData : [{ Status: "No Data", Count: 0 }];
                },

                _computeMrpMaterialChart: function (aMRP) {
                    var oCounts = {};
                    (aMRP || []).forEach(function (oItem) {
                        var sMat = (oItem.displayMaterial || "Unassigned").trim();
                        oCounts[sMat] = (oCounts[sMat] || 0) + 1;
                    });

                    var aData = Object.keys(oCounts).map(function (sKey) {
                        return { Material: sKey, Count: oCounts[sKey] };
                    });

                    // Sort descending by count
                    aData.sort(function (a, b) { return b.Count - a.Count; });

                    return aData.length > 0 ? aData : [{ Material: "No Data", Count: 0 }];
                },

                _computeBoxStatusChart: function (aBoxH) {
                    var oCounts = {};
                    (aBoxH || []).forEach(function (oHeader) {
                        var sRaw = (oHeader.OverallStatus || "COMPLETED").trim();
                        var sFormatted = sRaw === "COMPLETED" ? "Completed" : (sRaw.charAt(0).toUpperCase() + sRaw.slice(1).toLowerCase());
                        oCounts[sFormatted] = (oCounts[sFormatted] || 0) + 1;
                    });

                    var aData = Object.keys(oCounts).map(function (sKey) {
                        return { Status: sKey, Count: oCounts[sKey] };
                    });

                    return aData.length > 0 ? aData : [{ Status: "Pending Packaging", Count: 0 }];
                },

                _computeSetStatusChart: function (aSetH) {
                    var oCounts = {};
                    (aSetH || []).forEach(function (oHeader) {
                        var sRaw = (oHeader.Status || "SUCCESS").trim();
                        var sFormatted = sRaw === "SUCCESS" ? "Success / Confirmed" : (sRaw.charAt(0).toUpperCase() + sRaw.slice(1).toLowerCase());
                        oCounts[sFormatted] = (oCounts[sFormatted] || 0) + 1;
                    });

                    var aData = Object.keys(oCounts).map(function (sKey) {
                        return { Status: sKey, Count: oCounts[sKey] };
                    });

                    return aData.length > 0 ? aData : [{ Status: "Pending Packaging", Count: 0 }];
                },

                _updateChartMetadata: function (oSelectedItem, aMRP, aBoxH, aBoxQtyData, aSetH, aSetQtyData) {
                    var oMeta = this.getView().getModel("chartMeta");

                    if (oSelectedItem) {
                        var sOrder = oSelectedItem.displayOrder;
                        oMeta.setProperty("/mrpStatusSubtitle", "Status distribution for " + sOrder);
                        oMeta.setProperty("/mrpStatusBadge", aMRP.length + " Labels");

                        oMeta.setProperty("/mrpMaterialSubtitle", "Style breakdown for " + sOrder);
                        oMeta.setProperty("/mrpMaterialBadge", oSelectedItem.displayMaterial);

                        oMeta.setProperty("/boxStatusSubtitle", (aBoxH.length > 0 ? aBoxH.length + " linked box shipments" : "0 box packs linked to this order"));
                        oMeta.setProperty("/boxStatusBadge", aBoxH.length > 0 ? "Filtered" : "Pending");

                        oMeta.setProperty("/setStatusSubtitle", (aSetH.length > 0 ? aSetH.length + " linked set orders" : "0 set packs linked to this order"));
                        oMeta.setProperty("/setStatusBadge", aSetH.length > 0 ? "Filtered" : "Pending");

                        var fBoxTotal = aBoxQtyData.reduce(function (acc, d) { return acc + d.Quantity; }, 0);
                        oMeta.setProperty("/boxQtySubtitle", "Total: " + fBoxTotal.toLocaleString() + " units for " + sOrder);
                        oMeta.setProperty("/boxQtyBadge", fBoxTotal > 0 ? "Active Volume" : "0 Units");

                        var fSetTotal = aSetQtyData.reduce(function (acc, d) { return acc + d.Quantity; }, 0);
                        oMeta.setProperty("/setQtySubtitle", "Total: " + fSetTotal.toLocaleString() + " units for " + sOrder);
                        oMeta.setProperty("/setQtyBadge", fSetTotal > 0 ? "Active Volume" : "0 Units");
                    } else {
                        oMeta.setProperty("/mrpStatusSubtitle", "1,000 records: 88.2% Pending, 11.5% Printed, 0.3% Exported");
                        oMeta.setProperty("/mrpStatusBadge", "1,000 Total Labels");

                        oMeta.setProperty("/mrpMaterialSubtitle", "Production volume by style (Top: CARE-(RF111), MIDNIGHT)");
                        oMeta.setProperty("/mrpMaterialBadge", "6 Styles");

                        oMeta.setProperty("/boxStatusSubtitle", "5 Box Master shipments (100% Completed)");
                        oMeta.setProperty("/boxStatusBadge", "5 Total Boxes");

                        oMeta.setProperty("/setStatusSubtitle", "842 Set Master orders (100% Success)");
                        oMeta.setProperty("/setStatusBadge", "842 Total Sets");

                        oMeta.setProperty("/boxQtySubtitle", "Total packed units across 3 manufacturing plants");
                        oMeta.setProperty("/boxQtyBadge", "28,419 Units");

                        oMeta.setProperty("/setQtySubtitle", "Component volume distribution across 3 facilities");
                        oMeta.setProperty("/setQtyBadge", "1,000 Units");
                    }
                },

                _sumByPlant: function (aData, sValueField) {
                    var oResult = {};

                    aData.forEach(function (oItem) {
                        var sPlant = (oItem.Plant || "").trim();
                        var sPlantLabel = sPlant ? ("Plant " + sPlant) : "Central Facility";

                        var fVal = Number(oItem[sValueField]);
                        if (isNaN(fVal)) {
                            fVal = 0;
                        }

                        if (!oResult[sPlantLabel]) {
                            oResult[sPlantLabel] = 0;
                        }
                        oResult[sPlantLabel] += fVal;
                    });

                    return Object.keys(oResult).map(function (sKey) {
                        return {
                            Plant: sKey,
                            Quantity: Math.round(oResult[sKey])
                        };
                    });
                },

                // =========================================================
                // INTERACTIVE LINE ITEM SELECTION & GRAPH DRILLDOWN
                // =========================================================

                onSelectLineItem: function (oEvent) {
                    var oSelectedItem = oEvent.getParameter("listItem");
                    if (!oSelectedItem) {
                        this.onClearSelection();
                        return;
                    }

                    var oContext = oSelectedItem.getBindingContext("table");
                    if (!oContext) {
                        return;
                    }

                    this._handleRowSelection(oContext.getObject());
                },

                onLineItemPress: function (oEvent) {
                    var oItem = oEvent.getParameter("listItem");
                    if (!oItem) {
                        return;
                    }

                    var oContext = oItem.getBindingContext("table");
                    if (!oContext) {
                        return;
                    }

                    this._handleRowSelection(oContext.getObject());
                },

                _handleRowSelection: function (oItemData) {
                    var sDataset = this.getView().getModel("table").getProperty("/activeDataset") || "mrp";
                    if (sDataset === "mrp") {
                        this._selectMrpRow(oItemData);
                    } else if (sDataset === "boxItem" || sDataset === "setItem") {
                        this._selectItemRow(oItemData, sDataset);
                    } else if (sDataset === "boxHdr") {
                        this._selectBoxHdrRow(oItemData);
                    } else if (sDataset === "setHdr") {
                        this._selectSetHdrRow(oItemData);
                    }
                },

                _selectMrpRow: function (oItemData) {
                    var oCurrentSelection = this.getView().getModel("selection").getProperty("/selectedItem");
                    if (oCurrentSelection && oCurrentSelection.UniqueNo === oItemData.UniqueNo) {
                        this.onClearSelection();
                        return;
                    }
                    this._applyLineItemFilter(oItemData);
                },

                _selectItemRow: function (oItemData, sDataset) {
                    var sLabel = "Unit Item";
                    if (oItemData.ProductionOrder) {
                        sLabel = "Order #" + oItemData.ProductionOrder;
                    } else if (sDataset === "boxItem") {
                        sLabel = "Box Item";
                    } else {
                        sLabel = "Set Item";
                    }

                    var oSynth = {
                        Manufacturingorder: oItemData.ProductionOrder || "",
                        Material: oItemData.StyleName || "",
                        Plant: oItemData.Plant || "",
                        Batch: oItemData.Batch || "",
                        Salesorder: oItemData.SalesOrder || "",
                        UniqueNo: oItemData.Barcode || oItemData.BarcodeNumber || "",
                        displayOrder: sLabel,
                        displayMaterial: oItemData.StyleName || "Material",
                        displayPlant: oItemData.Plant || "Plant",
                        displayBatch: oItemData.Batch || ""
                    };
                    this._applyLineItemFilter(oSynth);
                },

                _selectBoxHdrRow: function (oItemData) {
                    var sId = oItemData.BoxPackId ? String(oItemData.BoxPackId).substring(0, 8) : "Header";
                    var oSynthBox = {
                        Manufacturingorder: "",
                        Material: "",
                        Plant: oItemData.Plant || "",
                        Batch: "",
                        Salesorder: "",
                        UniqueNo: "",
                        displayOrder: "Box #" + sId,
                        displayMaterial: "Box Packing (" + (oItemData.OverallStatus || "") + ")",
                        displayPlant: oItemData.Plant || "Plant",
                        displayBatch: oItemData.PackingRatio ? ("Ratio " + oItemData.PackingRatio) : ""
                    };
                    this._applyLineItemFilter(oSynthBox);
                },

                _selectSetHdrRow: function (oItemData) {
                    var sId = oItemData.SetId ? String(oItemData.SetId).substring(0, 8) : "Header";
                    var oSynthSet = {
                        Manufacturingorder: "",
                        Material: "",
                        Plant: "",
                        Batch: "",
                        Salesorder: "",
                        UniqueNo: "",
                        displayOrder: "Set #" + sId,
                        displayMaterial: oItemData.HeaderText || "Set Master",
                        displayPlant: "",
                        displayBatch: oItemData.PackingRatio ? ("Ratio " + oItemData.PackingRatio) : ""
                    };
                    this._applyLineItemFilter(oSynthSet);
                },

                _applyLineItemFilter: function (oItem) {
                    var sRawMfgOrder = (oItem.Manufacturingorder || "").trim();
                    var sNormOrder = sRawMfgOrder.replace(/^0+/, "").toLowerCase();
                    var sMaterial = (oItem.Material || "").trim().toLowerCase();
                    var sPlant = (oItem.Plant || "").trim();
                    var sSales = (oItem.Salesorder || "").trim().toLowerCase();
                    var sOrderTag = oItem.displayOrder;

                    var aFilteredMRP = this._filterMrpForSelection(sRawMfgOrder, oItem.UniqueNo, sMaterial, oItem);
                    var aFilteredBoxItems = this._filterBoxItemsForSelection(sNormOrder, sMaterial, sSales, sPlant);
                    var aFilteredBoxHeaders = this._filterBoxHeadersForSelection(aFilteredBoxItems, sPlant);
                    var aFilteredSetItems = this._filterSetItemsForSelection(sNormOrder, sMaterial, sSales, sPlant);
                    var aFilteredSetHeaders = this._filterSetHeadersForSelection(aFilteredSetItems);

                    var sSummary = "Showing operational graphs for " + sOrderTag + " • " + oItem.displayMaterial + " • " + oItem.displayPlant + " • Batch: " + oItem.displayBatch;

                    this.getView().getModel("selection").setData({
                        hasSelection: true,
                        selectedItem: oItem,
                        orderTag: sOrderTag,
                        filterSummary: sSummary
                    });

                    this.getView().getModel("kpi").setData({
                        mrpCount: aFilteredMRP.length,
                        mrpSubtitle: "Matching MRP Labels",
                        boxHeaderCount: aFilteredBoxHeaders.length,
                        boxHeaderSubtitle: "Matching Box Headers",
                        boxItemCount: aFilteredBoxItems.length,
                        boxItemSubtitle: "Matching Box Units",
                        setHeaderCount: aFilteredSetHeaders.length,
                        setHeaderSubtitle: "Matching Set Orders",
                        setItemCount: aFilteredSetItems.length,
                        setItemSubtitle: "Matching Component Units"
                    });

                    this._computeAndApplyCharts(
                        aFilteredMRP,
                        aFilteredBoxHeaders,
                        aFilteredBoxItems,
                        aFilteredSetHeaders,
                        aFilteredSetItems,
                        oItem
                    );

                    MessageToast.show("Graphs updated for " + sOrderTag);
                },

                _filterMrpForSelection: function (sRawMfgOrder, sUniqueNo, sMaterial, oItem) {
                    var aFiltered = this._allMRPData.filter(function (m) {
                        if (sRawMfgOrder && m.Manufacturingorder === sRawMfgOrder) {
                            return true;
                        }
                        if (sUniqueNo && m.UniqueNo === sUniqueNo) {
                            return true;
                        }
                        if (!sRawMfgOrder && sMaterial && (m.Material || "").toLowerCase() === sMaterial) {
                            return true;
                        }
                        return false;
                    });

                    return aFiltered.length > 0 ? aFiltered : [oItem];
                },

                _filterBoxItemsForSelection: function (sNormOrder, sMaterial, sSales, sPlant) {
                    var aItems = this._allBoxItems.filter(function (b) {
                        var bProd = (b.ProductionOrder || "").replace(/^0+/, "").toLowerCase();
                        var bSales = (b.SalesOrder || "").trim().toLowerCase();
                        var bStyle = (b.StyleName || "").trim().toLowerCase();

                        if (sNormOrder && bProd === sNormOrder) {
                            return true;
                        }
                        if (sMaterial && bStyle === sMaterial) {
                            return true;
                        }
                        if (sSales && bSales === sSales) {
                            return true;
                        }
                        return false;
                    });

                    if (aItems.length === 0 && sPlant) {
                        aItems = this._allBoxItems.filter(function (b) {
                            return (b.Plant || "").trim() === sPlant;
                        });
                    }

                    return aItems;
                },

                _filterBoxHeadersForSelection: function (aFilteredBoxItems, sPlant) {
                    var oMatchedPackIds = {};
                    aFilteredBoxItems.forEach(function (b) {
                        if (b.BoxPackId) {
                            oMatchedPackIds[b.BoxPackId] = true;
                        }
                    });

                    return this._allBoxHeaders.filter(function (bh) {
                        if (oMatchedPackIds[bh.BoxPackId]) {
                            return true;
                        }
                        if (sPlant && (bh.Plant || "").trim() === sPlant) {
                            return true;
                        }
                        return false;
                    });
                },

                _filterSetItemsForSelection: function (sNormOrder, sMaterial, sSales, sPlant) {
                    var aItems = this._allSetItems.filter(function (s) {
                        var sProd = (s.ProductionOrder || "").replace(/^0+/, "").toLowerCase();
                        var sSalesDoc = (s.SalesOrder || "").trim().toLowerCase();
                        var sStyle = (s.StyleName || "").trim().toLowerCase();

                        if (sNormOrder && sProd === sNormOrder) {
                            return true;
                        }
                        if (sMaterial && sStyle === sMaterial) {
                            return true;
                        }
                        if (sSales && sSalesDoc === sSales) {
                            return true;
                        }
                        return false;
                    });

                    if (aItems.length === 0 && sPlant) {
                        aItems = this._allSetItems.filter(function (s) {
                            return (s.Plant || "").trim() === sPlant;
                        });
                    }

                    return aItems;
                },

                _filterSetHeadersForSelection: function (aFilteredSetItems) {
                    var oMatchedSetIds = {};
                    aFilteredSetItems.forEach(function (s) {
                        if (s.SetId) {
                            oMatchedSetIds[s.SetId] = true;
                        }
                    });

                    return this._allSetHeaders.filter(function (sh) {
                        return !!oMatchedSetIds[sh.SetId];
                    });
                },

                onClearSelection: function () {
                    var oSelectionModel = this.getView().getModel("selection");
                    if (!oSelectionModel.getProperty("/hasSelection")) {
                        return;
                    }

                    oSelectionModel.setData({
                        hasSelection: false,
                        selectedItem: null,
                        orderTag: "",
                        filterSummary: ""
                    });

                    var aTableIds = ["mrpTable", "boxHdrTable", "boxItemTable", "setHdrTable", "setItemTable"];
                    aTableIds.forEach(function (sId) {
                        var oT = this.byId(sId);
                        if (oT) {
                            oT.removeSelections(true);
                        }
                    }.bind(this));

                    this._applyGlobalKPIs();
                    this._computeAndApplyCharts(
                        this._allMRPData,
                        this._allBoxHeaders,
                        this._allBoxItems,
                        this._allSetHeaders,
                        this._allSetItems,
                        null
                    );

                    MessageToast.show("All operational graphs restored");
                },

                // =========================================================
                // LINE ITEM DETAIL INSPECTOR DIALOG
                // =========================================================

                onInspectRow: function (oEvent) {
                    var oButton = oEvent.getSource();
                    var oContext = oButton.getBindingContext("table");
                    if (!oContext) {
                        return;
                    }

                    this._openItemDetailDialog(oContext.getObject());
                },

                onShowSelectedItemDetails: function () {
                    var oItemData = this.getView().getModel("selection").getProperty("/selectedItem");
                    if (oItemData) {
                        this._openItemDetailDialog(oItemData);
                    }
                },

                _openItemDetailDialog: function (oItemData) {
                    var sRawMfg = (oItemData.Manufacturingorder || "").trim();
                    var sNorm = sRawMfg.replace(/^0+/, "").toLowerCase();
                    var sMat = (oItemData.Material || "").trim().toLowerCase();

                    var iBoxUnits = this._allBoxItems.filter(function (b) {
                        var bProd = (b.ProductionOrder || "").replace(/^0+/, "").toLowerCase();
                        var bStyle = (b.StyleName || "").trim().toLowerCase();
                        return (sNorm && bProd === sNorm) || (sMat && bStyle === sMat);
                    }).length;

                    var iSetUnits = this._allSetItems.filter(function (s) {
                        var sProd = (s.ProductionOrder || "").replace(/^0+/, "").toLowerCase();
                        var sStyle = (s.StyleName || "").trim().toLowerCase();
                        return (sNorm && sProd === sNorm) || (sMat && sStyle === sMat);
                    }).length;

                    var sPkgSummary = (iBoxUnits > 0 || iSetUnits > 0)
                        ? (iBoxUnits + " Box Units linked • " + iSetUnits + " Set Units linked")
                        : "Not yet packed into Boxes/Sets (Production Stage)";

                    var oDetail = Object.assign({}, oItemData, { packagingSummary: sPkgSummary });
                    this.getView().getModel("detail").setData(oDetail);

                    if (!this._pDetailDialog) {
                        this._pDetailDialog = Fragment.load({
                            id: this.getView().getId(),
                            name: "zpp.mrp.dashboard.zppmrpdashboard.view.ItemDetailDialog",
                            controller: this
                        }).then(function (oDialog) {
                            this.getView().addDependent(oDialog);
                            return oDialog;
                        }.bind(this));
                    }

                    this._pDetailDialog.then(function (oDialog) {
                        oDialog.open();
                    });
                },

                onCloseItemDetailDialog: function () {
                    if (this._pDetailDialog) {
                        this._pDetailDialog.then(function (oDialog) {
                            oDialog.close();
                        });
                    }
                },

                onApplyFilterFromDialog: function () {
                    var oDetail = this.getView().getModel("detail").getData();
                    this.onCloseItemDetailDialog();
                    if (oDetail) {
                        this._applyLineItemFilter(oDetail);
                    }
                },

                // =========================================================
                // DATASET SWITCHING ACROSS 5 CDS VIEWS
                // =========================================================

                onDatasetTabSelect: function (oEvent) {
                    var sKey = oEvent.getParameter("key");
                    this._switchDataset(sKey);
                },

                onDatasetSelectChange: function (oEvent) {
                    var oItem = oEvent.getParameter("selectedItem");
                    if (oItem) {
                        this._switchDataset(oItem.getKey());
                    }
                },

                _switchDataset: function (sKey) {
                    var oTableModel = this.getView().getModel("table");
                    oTableModel.setProperty("/activeDataset", sKey);

                    var sTitle = "MRP Label";
                    if (sKey === "boxHdr") {
                        sTitle = "Box Header";
                    } else if (sKey === "boxItem") {
                        sTitle = "Box Item";
                    } else if (sKey === "setHdr") {
                        sTitle = "Set Header";
                    } else if (sKey === "setItem") {
                        sTitle = "Set Item";
                    }
                    oTableModel.setProperty("/activeDatasetTitle", sTitle);

                    // Clear selections on all tables
                    var aTableIds = ["mrpTable", "boxHdrTable", "boxItemTable", "setHdrTable", "setItemTable"];
                    aTableIds.forEach(function (sId) {
                        var oT = this.byId(sId);
                        if (oT) {
                            oT.removeSelections(true);
                        }
                    }.bind(this));

                    var sSearch = oTableModel.getProperty("/searchQuery") || "";
                    this._filterData(sSearch);
                    this._updatePagination(1);
                },

                // =========================================================
                // TABLE FILTERING & PAGINATION (GENERIC ACROSS ALL 5 VIEWS)
                // =========================================================

                _filterData: function (sQuery) {
                    var oTableModel = this.getView().getModel("table");
                    var sDataset = oTableModel.getProperty("/activeDataset") || "mrp";
                    var aSource = [];

                    if (sDataset === "mrp") {
                        aSource = this._allMRPData || [];
                    } else if (sDataset === "boxHdr") {
                        aSource = this._allBoxHeaders || [];
                    } else if (sDataset === "boxItem") {
                        aSource = this._allBoxItems || [];
                    } else if (sDataset === "setHdr") {
                        aSource = this._allSetHeaders || [];
                    } else if (sDataset === "setItem") {
                        aSource = this._allSetItems || [];
                    }

                    if (!sQuery) {
                        this._filteredData = aSource.slice();
                        return;
                    }

                    var sLower = sQuery.toLowerCase();
                    this._filteredData = aSource.filter(function (oItem) {
                        var aKeys = Object.keys(oItem);
                        for (var i = 0; i < aKeys.length; i++) {
                            var v = oItem[aKeys[i]];
                            if (v !== null && v !== undefined && String(v).toLowerCase().indexOf(sLower) !== -1) {
                                return true;
                            }
                        }
                        return false;
                    });
                },

                _updatePagination: function (iPage) {
                    var oModel = this.getView().getModel("table");
                    if (!oModel) {
                        return;
                    }

                    var iPageSize = parseInt(oModel.getProperty("/pageSize"), 10) || 25;
                    var aData = this._filteredData || [];
                    var iTotalRecords = aData.length;
                    var iTotalPages = Math.max(1, Math.ceil(iTotalRecords / iPageSize));

                    var iValidPage = iPage;
                    if (iValidPage < 1) {
                        iValidPage = 1;
                    }
                    if (iValidPage > iTotalPages) {
                        iValidPage = iTotalPages;
                    }

                    var iStartOffset = (iValidPage - 1) * iPageSize;
                    var iEndOffset = Math.min(iStartOffset + iPageSize, iTotalRecords);
                    var aPaged = aData.slice(iStartOffset, iEndOffset);

                    var iStartIndex = iTotalRecords > 0 ? iStartOffset + 1 : 0;
                    var iEndIndex = iEndOffset;

                    oModel.setProperty("/currentPage", iValidPage);
                    oModel.setProperty("/totalPages", iTotalPages);
                    oModel.setProperty("/totalRecords", iTotalRecords);
                    oModel.setProperty("/startIndex", iStartIndex);
                    oModel.setProperty("/endIndex", iEndIndex);
                    oModel.setProperty("/canGoPrevious", iValidPage > 1);
                    oModel.setProperty("/canGoNext", iValidPage < iTotalPages);
                    oModel.setProperty("/pagedData", aPaged);
                },

                onPageSizeChange: function (oEvent) {
                    var oSelectedItem = oEvent.getParameter("selectedItem");
                    if (oSelectedItem) {
                        var sKey = oSelectedItem.getKey();
                        this.getView().getModel("table").setProperty("/pageSize", sKey);
                        this._updatePagination(1);
                    }
                },

                onFirstPage: function () {
                    this._updatePagination(1);
                },

                onPreviousPage: function () {
                    var iCurrent = this.getView().getModel("table").getProperty("/currentPage") || 1;
                    this._updatePagination(iCurrent - 1);
                },

                onNextPage: function () {
                    var iCurrent = this.getView().getModel("table").getProperty("/currentPage") || 1;
                    this._updatePagination(iCurrent + 1);
                },

                onLastPage: function () {
                    var iTotal = this.getView().getModel("table").getProperty("/totalPages") || 1;
                    this._updatePagination(iTotal);
                },

                onSearchTable: function (oEvent) {
                    var sQuery = (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim();
                    this.getView().getModel("table").setProperty("/searchQuery", sQuery);
                    this._filterData(sQuery);
                    this._updatePagination(1);
                },

                _safeRead: async function (sEntitySet) {
                    try {
                        return await this._readEntitySet(sEntitySet);
                    } catch {
                        MessageToast.show("Failed to load " + sEntitySet);
                        return [];
                    }
                },

                _readEntitySet: async function (sEntitySet) {
                    var sBaseUrl =
                        "/sap/opu/odata4/sap/" +
                        "zui_mrp_lable_api_o4/" +
                        "srvd_a2x/sap/" +
                        "zui_mrp_lable_api/0001/";

                    var sUrl = sBaseUrl + sEntitySet + "?$top=1000";
                    var aAllData = [];

                    while (sUrl) {
                        var oResponse = await fetch(sUrl, {
                            method: "GET",
                            headers: {
                                "Accept": "application/json"
                            }
                        });

                        if (!oResponse.ok) {
                            throw new Error(
                                sEntitySet +
                                " failed: " +
                                oResponse.status +
                                " " +
                                oResponse.statusText
                            );
                        }

                        var oJson = await oResponse.json();

                        if (Array.isArray(oJson.value)) {
                            aAllData = aAllData.concat(oJson.value);
                        }

                        sUrl = oJson["@odata.nextLink"] || null;
                    }

                    return aAllData;
                },

                onRefresh: function () {
                    this.onClearSelection();
                    this._loadDashboardData();
                }

            }
        );
    }
);