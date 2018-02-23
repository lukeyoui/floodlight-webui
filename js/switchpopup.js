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
        success: function (table_data) {
            var table = $("#switchPopupFlowTable").DataTable({
                info: false,
                searching: false,
                lengthChange: false,
                paging: false,
                ordering: false,
                // TODO: Figure out why this was causing columns to not match width of data
                //scrollY: '200px',
                //scrollCollapse: true,
                data: table_data["flows"],
                columns: [
                    {
                        data: 'table_id'
                    },
                    {
                        data: 'match.in_port',
                        defaultContent: '*'
                    },
                    {
                        data: 'match.eth_src',
                        defaultContent: '*'
                    },
                    {
                        data: 'match.eth_dst',
                        defaultContent: '*'
                    },
                    {
                        data: 'priority'
                    },
                    {
                        data: 'match.eth_type',
                        defaultContent: '*'
                    },
                    {
                        data: 'instructions.instruction_apply_actions.actions'
                    },
                    {
                        data: 'packet_count'
                    }
                ]
            });

            /* Add highlights on selection of rows */
            $('#switchPopupFlowTable tbody').on('click', 'tr', function() {
                if ($(this).hasClass('active')) {
                    $(this).removeClass('active');
                } else {
                    table.$('tr.active').removeClass('active');
                    $(this).addClass('active');
                }
            });

            /* Add button handler for the visualize button */
            $('#switchPopupVisualize').click(function() {
                /* Open the warning dialog if nothing selected */
                var row_data = table.row('.active').data();
                if (row_data == null) {
                    $('#switchPopupModal').modal('show');
                } else {
                    visualize(row_data, id);
                }
            });

            /* Add button handler for the clear button */
            $('#clearFlow').on('click', function () {
                /* Clear the styles we added which will reset the page */
                $('body').removeClass('visualizing');
                top.cyto.elements().removeClass('path not-path');
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });

    /* Change link of switch detail button to point to right page */
    $("#switchPopupFullInfo").attr("href", "switchDetail.html?macAddress=" + id);
});

/**
 * Follows all the flows through the switches and highlights the path
 * that the flow takes through the network.
 *
 * @param row_data The row that is selected from the table to visualize
 * @param sID The data path ID of the switch
 */
function visualize(row_data, sID) {
    /* We only really care about matching match fields */
    var match_field = row_data.match;

    /* Hide the pop-up, this is really ugly but can't find other solution */
    $('.qtip').remove();

    /* Add a loading PNotify */
    var notice = new PNotify({
        title: 'Loading Visualization',
        text : 'Computing flow route for visualization.',
        type : 'notice',
        icon: 'fa fa-spinner fa-spin',
        hide : false,
        nonblock: {
            nonblock: true
        }
    });

    /* Query the flow route */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/routing/path/flow/" + sID + "/" + row_data.match.eth_src + "/" + row_data.match.eth_dst + "/" + row_data.match.eth_type + "/json",
        success: function (data) {
            /* We can't do anything if we have no data */
            if (data.length == 0) {
                return;
            }

            $('body').addClass('visualizing');

            /* Want to batch commit the changes so it only redraws once  */
            top.cyto.startBatch();

            /*
             * Loop through all the switches and add ones that have matching
             * fields to the path list and add the rest to the non-path list
             */
             top.cyto.$("node[type = 'SWITCH']").addClass('not-path');
             top.cyto.$("node[type = 'HOST']").addClass('not-path');

             /* Set all edges by default to not on the path */
             top.cyto.elements('edge').addClass('not-path');

             /* Add the first and last nodes because they will be missed by the loop */
             top.cyto.$("node[id = '" + data[0] + "']").addClass('path');
             top.cyto.$("node[id = '" + data[data.length - 1] + "']").addClass('path');

             /* Loop over the nodes and add the links to the path */
             top.cyto.$("edge[id = '" + data[1] + "_" + data[0] + "']").addClass('path');
             for (var i = 1; i < data.length - 1; i++) {
                 top.cyto.$("node[id = '" + data[i] + "']").addClass('path');
                 
                 /* Need to do this because we don't know direction */
                 top.cyto.$("edge[id = '" + data[i] + "_" + data[i + 1] + "']").addClass('path');
                 top.cyto.$("edge[id = '" + data[i + 1] + "_" + data[i] + "']").addClass('path');
             }

             top.cyto.endBatch();

             /* Let user know we've completed */
             notice.update({
                 title: 'Visualization Complete',
                 text : 'Flow visualization completed.',
                 type : 'success',
                 hide : true,
                 icon: 'fa fa-check'
             });
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);

            notice.update({
                title: 'Visualization Failed',
                text : 'There was an error trying to compute the route.',
                type : 'error',
                hide : true,
                icon: 'fa fa-exclamation-triangle'
            });
        }
    });
}
