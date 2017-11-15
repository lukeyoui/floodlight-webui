/**
 * Script loads the required data for the switch pop-up HTML element.
 *
 * File requires the following scripts to be included in the HTML:
 *    1) ../bower_components/jquery/dist/jquery.min.js
 *    2) ../js/querystringparser.js
 *    3) ../js/jquery.cookie.js
 *    4) ../bower_components/datatables/media/js/jquery.dataTables.min.js
 *    5) ../bower_components/datatables-plugins/integration/bootstrap/3/dataTables.bootstrap.min.js
 *    6) ../js/common.js
 *    7) ../js/switchpopup.js
 *
 * @see ../pages/switchpopup.html
 */
$(document).ready(function() {
    /* Load the IP and port for the controller */
    var ipaddress = $.cookie("cip");
    if (ipaddress == null || ipaddress == "") window.location.href = "login.html";
    var restport = $.cookie("cport");
    if (restport == null || restport == "") window.location.href = "login.html";

    /* Load the cookie for the current switch ID */
    var id = $.cookie("curSID");
    if (id == null || id == "") id = getQueryParameterByName("id");

    /* Load the data for the info tab */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/core/switch/" + id + "/desc/json",
        success: function(data) {
            $("#switchPopupVersion").html(data.desc["version"]);
            $("#switchPopupHWInfo").html(data.desc["hardware_description"]);
            $("#switchPopupVendor").html(data.desc["manufacturer_description"]);
            $("#switchPopupDPID").html(id);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Load the data for the flow summary page */
    $.ajax({
        url: " http://" + ipaddress + ":" + restport + "/wm/core/switch/" + id + "/features/json",
        success: function (data) {
            $("#switchPopupBuffer").html(data["buffers"]);
            $("#switchPopupTableCount").html(data["tables"]);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Load the data for the flow summary page */
    $.ajax({
        url: " http://" + ipaddress + ":" + restport + "/wm/core/switch/" + id + "/aggregate/json",
        success: function (data) {
            $("#switchPopupFlowCount").html(data.aggregate["flow_count"]);
            $("#switchPopupPacketCount").html(data.aggregate["packet_count"]);
            $("#switchPopupDataCount").html(formatSize(data.aggregate["byte_count"]));
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Load the flow table */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/core/switch/" + id + "/flow/json",
        success: function (dat) {
            $("#switchPopupFlowTable").DataTable({
                /* TODO: Need to look into scrolling feature */
                info: false,
                searching: false,
                lengthChange: false,
                paging: false,
                data: dat["flows"],
                columns: [
                    {data: 'table_id'},
                    {data: 'packet_count'},
                    {data: 'byte_count'},
                    {data: 'duration_sec'},
                    {data: 'priority'},
                    {data: 'idle_timeout_s'},
                    {data: 'hard_timeout_s'},
                    {data: 'flags'},
                    {data: 'instructions.instruction_apply_actions.actions'}
                ]
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Change link of button */
    $("#switchPopupFullInfo").attr("href", "switchDetail.html?macAddress=" + id);
});
