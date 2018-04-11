/**
 * Statistics script that listens for statistics data. Data is displayed
 * through graphs after selecting a link.
 *
 * @author nicolas.mccallum@carleton.ca
 */

/* Constant for the list of tables to subscribe to for the websocket */
var PORT_STATISTICS = "PortStatistics";
var FLOW_STATISTICS = "FlowStatistics";
var WEBSOCKET_TABLES = [PORT_STATISTICS, FLOW_STATISTICS];

/* Globals for the statistics data */
var portStatisticsData = {};
var flowStatisticsData = {};

/* Global handle for the web socket */
var socket;

/* Global for the statistics collection status */
var collectionEnabled = false;

/* Global for holding the current chart instance */
var currentChart = null;

/* Global variable for the refresh interval */
var intervalID = null;

/* Load the IP address and port for the controller */
var ipaddress = $.cookie('cip');
if (ipaddress == null || ipaddress == "") window.location.href = "login.html";
var restport = $.cookie('cport');
if (restport == null || restport == "") window.location.href = "login.html";

/* Setup when the document loads */
$(document).ready(function() {

    /* Add handler to show the link tab */
    $('#myButton a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
        $('#backButton').removeClass('disabled');
    });

    /* Add click handler on back button to show the home tab */
    $('#panelHeader a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
        $('#backButton').addClass('disabled');

        /* Remove the current chart event listener */
        currentChart.removeListener();
    });

    /* Add click handler to change statistics collection */
    $('#collectionChange').click(changeStatisticsCollection);

    /* Setup the websocket connnection */
    socket = new WebSocket("ws://localhost:8111/events/");
    socket.onmessage = onMessage;
    socket.onopen = onOpen;
    socket.onclose = onClose;

    /* Load the links for the table */
    loadLinks();

    /* Get the collection status initially and then set-up a refresh loop */
    getCollectionStatus();
    intervalID = setInterval(getCollectionStatus, 1000);

    /* Start the flow metrics garbage collection thread */
    setInterval(removeOldFlowMetrics, 5000);
});

/**
 * Called when the web socket connection is established. Subscribes to the
 * required tables on the controller.
 *
 * @param event Open event
 */
function onOpen(event) {
    console.log("WebSocket opened. Subscribing to tables: " + WEBSOCKET_TABLES);
    socket.send(JSON.stringify({"subscribe": WEBSOCKET_TABLES}));
}

/**
 * Called when the web socket connection closes. Log the event and return.
 *
 * @param event Close event
 */
function onClose(event) {
    console.log("Websocket connection was closed.");
}

/**
 * Message handler for the web socket. Each message that is received calls
 * this function.
 *
 * @param event Event that contains the message received
 */
function onMessage(event) {
    /* Try and parse the incoming message into JSON */
    var msg;
    try {
        msg = JSON.parse(event.data);
    } catch (e) {
        /* Log that we received un-parsable message */
        console.log("Received un-parsable message from websocket: ", event);
        return;
    }

    /* Check the message type and go to the correct handler */
    switch (msg.table) {
        case PORT_STATISTICS:
            onPortStatisticsMessage(msg);
            break;
        case FLOW_STATISTICS:
            onFlowStatisticsMessage(msg);
            break;
        default:
            console.log("Unknown message type from websocket: ", msg.table);
    }
}

/**
 * Message handler for the port statistics messages. Adds the port statistics
 * to the current list of data. Also creates an event using the switch and
 * the port as the ID so that the chart is updated live if listening to the
 * same event.
 *
 * @param msg Port statistics message that was sent
 */
function onPortStatisticsMessage(msg) {
    /* Grab all of the fields from the message */
    var dpid = msg.dpid;
    var port = msg.portid;
    //var cap = msg.currentSpeed * 1000;
    var cap = 3000;
    var bw = msg.speedRX + msg.speedTX;
    var deleted = msg.deleted;

    /* We can't do anything about local ports or deleted rows */
    if (port == "local" || deleted == true) {
        return;
    }

    /* Call our chart event listener */
    var dataID = msg.dpid + "_" + msg.portid.toString();
    var time = new Date().getTime();
    var evt = $.Event('newPortStatistic');
    evt.time = time;
    evt.bw = bw;
    evt.id = dataID;
    $(window).trigger(evt);

    /* Add the data into the list of tracked data */
    if (dataID in portStatisticsData) {
        portStatisticsData[dataID]["bandwidth"].push(bw);
        portStatisticsData[dataID]["time"].push(time);
    } else {
        /* If not already initialized, initialize it */
        portStatisticsData[dataID] = {"bandwidth": [], "time": []};
        portStatisticsData[dataID]["bandwidth"] = [bw];
        portStatisticsData[dataID]["time"] = [time];
    }
}

/**
 * Adds the flow statistics data to the collection and updates the chart
 * by sending the events out.
 *
 * @param msg Flow statistics message from the web socket
 */
function onFlowStatisticsMessage(msg) {
    /* LLDP flows have no identifiers so we can skip them */
    if (msg.port == null || msg.deleted == true) {
        return;
    }

    /* Make sure we have a dictionary on the data ID before continuing */
    var dataID = msg.dpid + "_" + msg.port.toString();
    if (!(dataID in flowStatisticsData)) {
        flowStatisticsData[dataID] = {};
    }

    /* Add the data to the current tracking dictionary */
    var dictID = msg.ethsrc + "_" + msg.ethdst + "_" + msg.ethtype.toString();
    var evt;
    if (dictID in flowStatisticsData[dataID]) {
        evt = $.Event('updateFlowStatistic');
    } else {
        evt = $.Event('newFlowStatistic');
    }

    /* Call our chart event listener */
    msg.label = 'Src: ' + msg.ethsrc + ' Dst: ' + msg.ethdst + ' Type: ' + msg.ethtype.toString();
    msg.timestamp = new Date().getTime();
    flowStatisticsData[dataID][dictID] = msg;
    evt.speed = msg.speed;
    evt.label = msg.label;
    evt.id = dataID;
    $(window).trigger(evt);
}

/**
 * Removes old flow statistics from the data set. Checks if any entries have
 * not been updated in 15 seconds, and if they haven't then we can consider
 * the flow to not exist and remove the data. Sends out an event when
 * a data set is deleted.
 */
function removeOldFlowMetrics() {
    var ct = new Date().getTime();

    /* Loop through the flow metrics */
    for (var dID in flowStatisticsData) {
        for (var fID in flowStatisticsData[dID]) {
            if ((ct - flowStatisticsData[dID][fID].timestamp) > 15000) {
                var evt = $.Event('removeFlowStatistic');
                evt.label = flowStatisticsData[dID][fID].label;
                evt.id = dID;
                $(window).trigger(evt);

                console.log("Removing old flow: ", evt.label);
                delete flowStatisticsData[dID][fID];
            }
        }
    }
}

/**
 * Loads the collection status from the controller. Changes the color and
 * image of the alert on the page to match the status.
 */
function getCollectionStatus() {
    $.ajax({
        type: "GET",
        dataType: 'json',
        url: "http://" + ipaddress + ":" + restport + "/wm/statistics/config/json",

        success: function (data) {
            /* Check the status of the statistics collection */
            if (data['statistics-collection'] == "disabled") {
                /* If it is disabled then change the alert to idle */
                $("#collectionStatus").html("Idle");
                $("#collectionAlert").addClass("alert-danger");
                $("#collectionAlert").removeClass("alert-success");
                $("#collectionAlert").removeClass("alert-info");
                $("#collectionImg").removeClass("fa-question-circle");
                $("#collectionImg").removeClass("fa-check-circle");
                $("#collectionImg").addClass("fa-times-circle");
                collectionEnabled = false;
            } else {
                /* If it is enabled then change the alert to active */
                $("#collectionStatus").html("Active");
                $("#collectionAlert").addClass("alert-success");
                $("#collectionAlert").removeClass("alert-danger");
                $("#collectionAlert").removeClass("alert-info");
                $("#collectionImg").removeClass("fa-times-circle");
                $("#collectionImg").removeClass("fa-question-circle");
                $("#collectionImg").addClass("fa-check-circle");
                collectionEnabled = true;
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log('Error: ' + " " + jqXHR.responseText +
                        "\nStatus: " + textStatus +
                        "\nError Thrown: " + errorThrown);

            /* If we hit a 404 error then the server shut down so stop */
            if (jqXHR.status == 404 || jqXHR.status == 0) {
                clearInterval(intervalID);
                console.log("Stopping refresh due to 404 from server");
            }
        }
    });
}

/**
 * Changes the current statistics collection status to the opposite based on
 * the current value of the collectionEnabled variable.
 */
function changeStatisticsCollection(event) {
    /* Do the opposite of the current boolean and then let the page reload */
    if (collectionEnabled) {
        closeStatistic();
    } else {
        openStatistic();
    }
}

/**
 * Changes the statistics collection state to enabled.
 */
function openStatistic() {
    $.ajax({
        type    : "PUT",
        dataType: 'json',
        url     : "http://" + ipaddress + ":" + restport + "/wm/statistics/config/enable/json",

        success: function (data) {
            new PNotify({
                title: 'Statistic Status Changed',
                text : 'Statistics are enabled.',
                type : 'success',
                hide : true
            });

            collectionEnabled = false;
        },
        error  : function (jqXHR, textStatus, errorThrown) {
            alert('Error: ' + " " + jqXHR.responseText +
                  "\nStatus: " + textStatus +
                  "\nError Thrown: " + errorThrown);
        }
    });
}

/**
 * Changes the statistics collection state to disabled.
 */
function closeStatistic() {
    $.ajax({
        type    : "PUT",
        dataType: 'json',
        url     : " http://" + ipaddress + ":" + restport + "/wm/statistics/config/disable/json",
        success : function (data) {
            new PNotify({
                title: 'Statistic Status Changed',
                text : 'Statistics are disabled.',
                type : 'success',
                hide : true
            });

            collectionEnabled = true;
        },
        error   : function (jqXHR, textStatus, errorThrown) {
            alert('Error: ' + " " + jqXHR.responseText +
                  "\nStatus: " + textStatus +
                  "\nError Thrown: " + errorThrown);
        }
    });
}

/**
 * Loads the links into the table on the page.
 */
function loadLinks() {
    $.ajax({
        type    : "GET",
        dataType: 'json',
        url     : " http://" + ipaddress + ":" + restport + "/wm/topology/links/json",
        success : function (table_data) {
            var table = $("#linkTable").DataTable({
                info: false,
                searching: false,
                lengthChange: false,
                paging: false,
                data: table_data,
                columns: [
                    {data: 'src-switch'},
                    {data: 'src-port'},
                    {data: 'dst-switch'},
                    {data: 'dst-port'},
                    {data: 'latency'}
                ]
            });

            /* Add highlights on selection of rows */
            $('#linkTable tbody').on('click', 'tr', function() {
                if ($(this).hasClass('active')) {
                    $(this).removeClass('active');
                } else {
                    table.$('tr.active').removeClass('active');
                    $(this).addClass('active');
                }
            });

            /* Add button handler for the link button */
            $('#viewLink').click(function() {
                /* Open the warning dialog if nothing selected */
                var row_data = table.row('.active').data();
                if (row_data == null) {
                    $('#statisticsModal').modal('show');
                } else {
                    var id = row_data["src-switch"] + "_" + row_data["src-port"];
                    loadChart(id);
                    $('#tabLink').tab('show');
                }
            });
        },
        error   : function (jqXHR, textStatus, errorThrown) {
            alert('Error: ' + " " + jqXHR.responseText +
                  "\nStatus: " + textStatus +
                  "\n Error Thrown: " + errorThrown);
        }
    });
}

/**
 * Class that contains the listeners for the line and doughnut charts.
 *
 * Provides utilites to register all the event listeners on a single ID
 * and to unregister all event listeners on the data ID.
 */
class ChartListener {

    /**
     * Constructor.
     *
     * @param lineChart Chart object for the line chart
     * @param doughnutChart Chart object for the doughnut chart
     * @param dataID ID to listen for updates on
     */
    constructor(lineChart, doughnutChart, dataID) {
        this.lineChart = lineChart;
        this.doughnutChart = doughnutChart;
        this.dataID = dataID;
        this.lineChartListener = this._lineChartListener.bind(this);
        this.doughnutChartNewValue = this._doughnutChartNewValue.bind(this);
        this.doughnutChartUpdateValue = this._doughnutChartUpdateValue.bind(this);
        this.doughnutChartRemoveValue = this._doughnutChartRemoveValue.bind(this);
    }

    /**
     * Registers all the event listeners for both chart instances. If an
     * event comes in that has the same data ID, the charts are updated with
     * the new data.
     */
    registerListener() {
        /* Register the line chart listener for port statistics */
        console.log("Adding line chart listener for ID: " + this.dataID);
        $(window).on('newPortStatistic', this.lineChartListener);

        /* Register the doughnut chart for flow statistics */
        console.log("Adding doughnut chart listener for ID: " + this.dataID);
        $(window).on('newFlowStatistic', this.doughnutChartNewValue);
        $(window).on('updateFlowStatistic', this.doughnutChartUpdateValue);
        $(window).on('removeFlowStatistic', this.doughnutChartRemoveValue);
    }

    /**
     * Removes all listeners for both of the charts. Also destroys both chart
     * instances so new charts can be created in their place.
     */
    removeListener() {
        /* Unregister the line chart listener */
        console.log("Removing line chart listener for ID: " + this.dataID);
        $(window).off('newPortStatistic', this.lineChartListener, true);

        /* Unregister the doughnut chart listener */
        console.log("Removing doughnut chart listener for ID: " + this.dataID);
        $(window).off('newFlowStatistic', this.doughnutChartNewValue, true);
        $(window).off('updateFlowStatistic', this.doughnutChartUpdateValue, true);
        $(window).off('removeFlowStatistic', this.doughnutChartRemoveValue, true);

        /* Remove both the charts to get rid of the data */
        this.lineChart.destroy();
        this.doughnutChart.destroy();
    }

    /**
     * Listener for the line chart that adds a new data point for each new
     * event that matches the data ID.
     */
    _lineChartListener(e) {
        if (e.id == this.dataID) {
            this.lineChart.data.labels.push(e.time);
            this.lineChart.data.datasets[0].data.push(e.bw);
            this.lineChart.update();
        }
    }

    /**
     * Listener for the doughnut chart that adds a new segment into the
     * chart for a new data type.
     */
    _doughnutChartNewValue(e) {
        /* Ensure the event is for our chart */
        if (e.id != this.dataID) {
            return;
        }

        /* Check if the chart has datasets before continuing */
        if (this.doughnutChart.data.datasets.length < 1) {
            console.log("No datasets in doughnut chart...");
            return;
        }

        /* Add the new data to the dataset */
        this.doughnutChart.data.datasets[0].data.push(e.speed);
        this.doughnutChart.data.datasets[0].backgroundColor.push(randomColor());
        this.doughnutChart.data.labels.push(e.label);

        /* Update the chart */
        this.doughnutChart.update();
    }

    /**
     * Listener for the doughnut chart that updates the current size of a
     * segment that already exists on the chart.
     */
    _doughnutChartUpdateValue(e) {
        /* Ensure the event is for our chart */
        if (e.id != this.dataID) {
            return;
        }

        /* Check if the chart has datasets before continuing */
        if (this.doughnutChart.data.datasets.length < 1) {
            console.log("No datasets in doughnut chart...");
            return;
        }

        /* Add the new data to the dataset */
        var index = this.doughnutChart.data.labels.indexOf(e.label);
        this.doughnutChart.data.datasets[0].data = this.doughnutChart.data.datasets[0].data.map(function(val, i) {
            if (i == index) {
                return e.speed;
            } else {
                return val;
            }
        });

        /* Update the chart */
        this.doughnutChart.update();
    }

    /**
     * Listener for the doughnut chart that removes a segment of the chart
     * when the value times out from lack of updates.
     */
    _doughnutChartRemoveValue(e) {
        /* Ensure the event is for our chart */
        if (e.id != this.dataID) {
            return;
        }

        /* Check if the chart has datasets before continuing */
        if (this.doughnutChart.data.datasets.length < 1) {
            console.log("No datasets in doughnut chart...");
            return;
        }

        /* Remove the data from the dataset starting with the label */
        var index = this.doughnutChart.data.labels.indexOf(e.label);

        /* If we don't have that label we can just leave */
        if (index <= -1) {
            return;
        }

        this.doughnutChart.data.labels.splice(index, 1);
        this.doughnutChart.data.datasets[0].data.splice(index, 1);

        /* Update the chart */
        this.doughnutChart.update();
    }
}

/**
 * Loads the line and doughnut charts using the stored data.
 *
 * Also starts the event listeners contained in the chart listener class.
 *
 * @param id The data ID in the statistics dictionaries
 */
function loadChart(id) {
    /* If no data we want to just load an empty graph */
    var labels = (id in portStatisticsData) ? portStatisticsData[id]['time'].slice(0) : [];
    var data = (id in portStatisticsData) ? portStatisticsData[id]['bandwidth'].slice(0): [];

    /* Add a new line chart to the canvas */
    var lineCtx = document.getElementById('linkChart').getContext('2d');
    var lineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bandwidth',
                backgroundColor: 'rgb(0, 0, 0, 0.1)',
                borderColor: 'rgb(0, 0, 0)',
                data: data,
            }]
        }
    });

    /* Construct the doughnut chart values from the statistics list */
    var data = [];
    var colors = [];
    var labels = [];
    for (var flowID in flowStatisticsData[id]) {
        data.push(flowStatisticsData[id][flowID].speed);
        colors.push(randomColor());
        labels.push(flowStatisticsData[id][flowID].label);
    }

    /* Add doughnut chart for the flows to the other canvas */
    document.getElementById('flowChart').style.height = document.getElementById('linkChart').style.height;
    var doughnutCtx = document.getElementById('flowChart').getContext('2d');
    var doughnutChart = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                backgroundColor: colors,
                data: data
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            tooltips: {
                mode: 'label',
                callbacks: {
                    label: function(item, data) {
                        return data.datasets[0].data[item.index] + '';
                    }
                }
            }
        }
    });

    /* Create the new chart listener and register the event listener */
    currentChart = new ChartListener(lineChart, doughnutChart, id);
    currentChart.registerListener();
}

/**
 * Random color generating function based off:
 * https://martin.ankerl.com/2009/12/09/how-to-create-random-colors-programmatically/
 */
function randomColor() {
    var h = (Math.random() + 0.618033988749895) % 1;
    var h_i = Math.floor(h * 6);
    var v = 0.95;
    var s = 0.5;
    var f = h * 6 - h_i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    var r;
    var g;
    var b;

    if (h_i == 0) {
        r = v;
        g = t;
        b = p;
    } else if (h_i == 1) {
        r = q;
        g = v;
        b = p;
    } else if (h_i == 2) {
        r = p;
        g = v;
        b = t;
    } else if (h_i == 3) {
        r = p;
        g = q;
        b = v;
    } else if (h_i == 4) {
        r = t;
        g = p;
        b = v;
    } else {
        r = v;
        g = p;
        b = q;
    }

    return "rgb(" + Math.floor(r * 256) + "," + Math.floor(g * 256) + "," + Math.floor(b * 256) + ")";
}
