/*global QUnit*/

sap.ui.define([
	"zpp/mrp/dashboard/zppmrpdashboard/controller/ZI_MRP_LABLE1.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ZI_MRP_LABLE1 Controller");

	QUnit.test("I should test the ZI_MRP_LABLE1 controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
