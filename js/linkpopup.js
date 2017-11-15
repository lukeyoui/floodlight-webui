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
    if (src == null || src == "") id = getQueryParameterByName("src");
    if (dst == null || dst == "") id = getQueryParameterByName("dst");

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
