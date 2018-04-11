/**
 * Script loads the required data for the host pop-up HTML element.
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
 * @see ../pages/hostpopup.html
 */
$(document).ready(function() {
    /* Load the IP and port for the controller */
    var ipaddress = $.cookie("cip");
    if (ipaddress == null || ipaddress == "") window.location.href = "login.html";
    var restport = $.cookie("cport");
    if (restport == null || restport == "") window.location.href = "login.html";

    /* Load the cookie for the current host MAC */
    var mac = $.cookie("popupMAC");
    if (mac == null || mac == "") id = getQueryParameterByName("MAC");

    /* Fill in the info and connections tabs */
    $.ajax({
        url: "http://" + ipaddress + ":" + restport + "/wm/device/",
        success: function(data) {
            /* Have to search for our MAC in the list */
            var device = null;
            for (var i = 0; i < data['devices'].length; i++) {
                if (data['devices'][i]['mac'][0] == mac) {
                    device = data['devices'][i];
                    break;
                }
            }

            /* Check that we found the device or exit if we didn't */
            if (!device) {
                console.log("Could not find connected host: " + mac);
                return;
            }

            /* Set the fields in the info tab */
            var d = new Date(device['lastSeen']);
            $("#hostPopupIP").html(device['ipv4'].length ? device['ipv4'][0] : device['ipv6'][0]);
            $("#hostPopupMAC").html(mac);
            $("#hostPopupLastSeen").html(("0" + d.getDate()).slice(-2) + "/" +
                                         ("0" + (d.getMonth() + 1)).slice(-2) + "/" +
                                         d.getFullYear() + " " +
                                         ("0" + d.getHours()).slice(-2) + ":" +
                                         ("0" + d.getMinutes()).slice(-2) + ":" +
                                         ("0" + d.getSeconds()).slice(-2));

            /* Add links to the link table */
            $("#hostPopupLinksTable").DataTable({
                /* TODO: Need to look into scrolling feature */
                info: false,
                searching: false,
                lengthChange: false,
                paging: false,
                data: device["attachmentPoint"],
                columns: [
                    {
                        data: null,
                        sortable: false,
                        sClass: "datatable-center",

                        /* Add an index number as the first row */
                        render: function (data, type, row, meta) {
                            return meta.row + meta.settings._iDisplayStart + 1;
                        }
                    },
                    {
                        data: "switch",
                        sClass: "datatable-center"
                    },
                    {
                        data: "port",
                        sClass: "datatable-center"
                    }
                ]
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText + "\nStatus: " +
                        textStatus + "\nError Thrown: " + errorThrown);
        }
    });
});
