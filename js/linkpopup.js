/**
 * Script loads the required data for the link pop-up HTML element.
 *
 * File requires the following scripts to be included in the HTML:
 *    1) ../bower_components/jquery/dist/jquery.min.js
 *    2) ../js/querystringparser.js
 *    3) ../js/jquery.cookie.js
 *    6) ../js/common.js
 *
 * @see ../pages/linkpopup.html
 */
$(document).ready(function() {
    /* Load the IP and port for the controller */
    var ipaddress = $.cookie("cip");
    if (ipaddress == null || ipaddress == "") window.location.href = "login.html";
    var restport = $.cookie("cport");
    if (restport == null || restport == "") window.location.href = "login.html";

    /* Load the cookie for the current switch ID */
    var src = $.cookie("popupLinkSrc");
    var dst = $.cookie("popupLinkDst");
    var srcPort = $.cookie("popupLinkSrcPort");
    var dstPort = $.cookie("popupLinkDstPort");
    var blockable = $.cookie("popupLinkBlockable");
    if (src == null || src == "") id = getQueryParameterByName("src");
    if (dst == null || dst == "") id = getQueryParameterByName("dst");
    /* TODO: Need to add the rest as query parameters here */

    /* Some links are not blockable, so disable if we are one of those */
    if (blockable == "false") {
        /* TODO: This isn't working for some reason */
        $("#linkPopupBlockButton").attr("disabled", true);

        /*
         * Bootstrap is stupid and you have to disable the onclick
         * or else it will just go through anyways
         */
         $("#linkPopupBlockButton").removeAttr("data-toggle");
         $("#linkPopupBlockButton").on("click", function(e) {
             e.preventDefault();
         });
    }

    /* Add button handler for turning on statistics collection */
    $("#linkPopupStatsEnable").click(function() {
        $.ajax({
            url: "http://" + ipaddress + ":" + restport + "/wm/statistics/config/enable/json",
            type: "PUT",
            dataType: 'json',
            data: "",    /* The REST API only wants an empty string */
            success: function(data) {
                var notice = new PNotify({
                    title: "Statistic Status Changed",
                    text: "Statistics are enabled.",
                    type: "success"
                });

                notice.get().click(function() {
                    notice.remove();
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                            textStatus + "\nError Thrown: " + errorThrown);
            }
        });
    });

    /* Add button handler for turning off statistics collection */
    $("#linkPopupStatsDisable").click(function() {
        $.ajax({
            url: "http://" + ipaddress + ":" + restport + "/wm/statistics/config/disable/json",
            type: "PUT",
            dataType: 'json',
            data: "",    /* The REST API only wants an empty string */
            success: function(data) {
                var notice = new PNotify({
                    title: "Statistic Status Changed",
                    text: "Statistics are disabled.",
                    type: "success"
                });

                notice.get().click(function() {
                    notice.remove();
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                            textStatus + "\nError Thrown: " + errorThrown);
            }
        });
    });

    /* Add button handler for blocking links */
    $("#linkPopupLinkBlock").click(function() {
        $.ajax({
            url: "http://" + ipaddress + ":" + restport + "/wm/topology/links/block/json",
            type: "POST",
            dataType: 'json',
            data: JSON.stringify({
                "src-switch": src,
	            "src-port": parseInt(srcPort, 10),
	            "dst-switch": dst,
	            "dst-port": parseInt(dstPort, 10)
            }),
            success: function(data) {
                var notice = new PNotify({
                    title: "Link Status Changed",
                    text: "Link was blocked.",
                    type: "success"
                });

                notice.get().click(function() {
                    notice.remove();
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                            textStatus + "\nError Thrown: " + errorThrown);
            }
        });
    });

    /* Add button handler for un-blocking links */
    $("#linkPopupLinkUnblock").click(function() {
        $.ajax({
            url: "http://" + ipaddress + ":" + restport + "/wm/topology/links/unblock/json",
            type: "POST",
            dataType: 'json',
            data: JSON.stringify({
                "src-switch": src,
	            "src-port": parseInt(srcPort, 10),
	            "dst-switch": dst,
	            "dst-port": parseInt(dstPort, 10)
            }),
            success: function(data) {
                var notice = new PNotify({
                    title: "Link Status Changed",
                    text: "Link was un-blocked.",
                    type: "success"
                });

                notice.get().click(function() {
                    notice.remove();
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                            textStatus + "\nError Thrown: " + errorThrown);
            }
        });
    });

    /* Load the statistical data (bandwidth and capacity) */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/statistics/bandwidth/" + src + "/1/json",
        dataType: "json",
        success: function(data) {
            var bandwidth = parseInt(data[0]["bits-per-second-rx"]) + parseInt(data[0]["bits-per-second-tx"]);
            $("#linkPopupBandwidth").html(formatSpeed(bandwidth));
            $("#linkPopupCapacity").html(formatSpeed(data[0]["link-speed-bits-per-second"]));
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Load basic link data */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/core/switch/" + src + "/flow/json",
        dataType: "json",
        success: function(data) {
            $("#linkPopupPacketCount").html(data.flows[0]["packet_count"]);
            $("#linkPopupDataCount").html(formatSize(data.flows[0]["byte_count"]));
            $("#linkPopupEP1").html(src);
            $("#linkPopupEP2").html(dst);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });
});
