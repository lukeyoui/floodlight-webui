/**
 * Topology script that will load all the switches and hosts in the network
 * and the links between them.
 *
 * @author nicolas.mccallum@carleton.ca
 */

/* Declare some constant values for the types of nodes we can add */
var NODE_SWITCH = "SWITCH";
var NODE_HOST = "HOST";

/* Define some constants for background colour */
var SWITCH_BG_COLOR = "#CE4345";
var SWITCH_BORDER_COLOR = "#510001";
var HOST_BORDER_COLOR = "#08264B";
var HOST_BG_COLOR = "#589DFE";
var DEFAULT_EDGE_COLOR = "#000000";
var BLOCKED_EDGE_COLOR = "#444444";

/* Constants for the background images */
var SWITCH_BG_IMG = "../bower_components/Font-Awesome-SVG-PNG/black/png/128/random.png";
var HOST_BG_IMG = "../bower_components/Font-Awesome-SVG-PNG/black/png/128/desktop.png";

/* Constants for the cytoscape shapes for the nodes */
var SWITCH_SHAPE = "roundrectangle";
var HOST_SHAPE = "ellipse";

/* Constant for default line weights */
var DEFAULT_EDGE_WEIGHT = 10;
var MIN_EDGE_WEIGHT = 5;
var MAX_EDGE_WEIGHT = 15;

/* Constants for edge opacity */
var DEFAULT_EDGE_OPACITY = 0.80;
var BLOCKED_EDGE_OPACITY = 0.40;

/* Constants for edge width */
var DEFAULT_EDGE_WIDTH = 10;

/* Constant for length of MAC in string form */
var MAC_LEN = 17;

/* Placeholder for the graph */
var cyto = null;

/* Cache for bandwidth values */
var bandwidth = [];
var capacities = [];

/* Cache for the nodes and edges to load into the topology graph */
var nodes = [];
var edges = [];

/* Globals for the IP and port of the REST server */
var ip = "";
var port = "";

$(document).ready(function() {
    /* These cookies are set on the login page at login.html. They are simply
     * the IP address of your controller and the REST api port. */
    ip = $.cookie('cip');
    if (ip == null || ip == "") window.location.href = "login.html";
    port = $.cookie('cport');
    if (port == null || port == "") window.location.href = "login.html";

    /* We want to wait until all of our data is loaded before we start
     * to draw the cytoscape graph. So set up the methods so that they
     * return Promise objects and we can wait for all of them to finish
     * before we start doing anything with the cytoscape graph. */
    var promises = [];
    promises.push(loadStatisticsData());
    promises.push(loadSwitches());
    promises.push(loadInternalLinks());
    promises.push(loadHosts());

    /* Wait for all to finish */
    Promise.all(promises).then(function() {
        /* Once we have all the data we can draw the graph */
        return draw();

    }, function(err) {
        /* If there was an error log it to the console */
        console.log('Error loading the data: ', err);

    }).then(loadBlockedLinks).then(function() {
        /* Start our web-socket connection */
        /* TODO: Find way to get this without hard coding */
        var socket = new WebSocket("ws://localhost:8111/events/");
        socket.onmessage = onMessage;

        /* Send our subscription message */
        socket.send(JSON.stringify({"subscribe": ["PortStatistics"]}));
    });
});

function reload() {
    Promise.resolve(loadStatisticsData()).then(function () {
        for (var i = 0; i < capacities.length; i++) {
            var dpid = capacities[i]['dpid'];
            var port = parseInt(capacities[i]['port']);
            var cap = parseInt(capacities[i]['link-speed-bits-per-second']) * 1000;
            var bw = parseInt(capacities[i]["bits-per-second-rx"]) + parseInt(capacities[i]["bits-per-second-tx"]);
            var color = scaleColor(cap, bw);

            if (capacities[i]['port'] == "local") {
                continue;
            }

            if (bw > 10000) {
                console.log("changing: " + color + ", " + dpid);
            }

            cyto.elements("edge[source = '" + dpid + "'][source_port = " + port + "]").animate({
                style: {
                    'line-color': color
                }
            }, {
                duration: 5000,
                complete: function() {
                    console.log("Done");
                }
            });
        }
    }, function (err) {
        console.log('Error:', err);
    });
}

function onMessage(msg) {
    console.log("Got msg: ", msg);
    var msgJSON = JSON.parse(msg);

    /* We can't do anything about local ports */
    if (msgJSON.get('portid') == "local") {
        continue;
    }

    var dpid = msgJSON.get('dpid');
    var port = parseInt(msgJSON.get('portid'));
    var cap = parseInt(msgJSON.get('currentSpeed')) * 1000;
    var bw = parseInt(msgJSON.get('speedRX')) + parseInt(msgJSON.get('speedTX'));
    var color = scaleColor(cap, bw);

    cyto.elements("edge[source = '" + dpid + "'][source_port = " + port + "]").animate({
        style: {
            'line-color': color
        }
    }, {
        duration: 5000,
        complete: function() {
            console.log("Done");
        }
    });
}

/**
 * Initializes the cytoscape topology graph. Sets all of the CSS styles for
 * the nodes (switches) and edges (links). Also sets the topology
 * configuration for layout and general appearance on start-up.
 */
function draw() {
    /* Create the cytoscape graph */
    cyto = cytoscape({
        container: document.getElementById("cy"),
        elements: {
            nodes: nodes,
            edges: edges
        },
        /* Set the CSS styles for the graph */
        style: cytoscape.stylesheet()
            /* Node CSS */
            .selector('node').css({
                /* Select the shape of the node based off the type */
                'shape': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? SWITCH_SHAPE : HOST_SHAPE;
                },

                /* Set the background colour based on the type */
                'background-color': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? SWITCH_BG_COLOR : HOST_BG_COLOR;
                },

                /* Set the background image using rendered FA icons */
                'background-image': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? SWITCH_BG_IMG : HOST_BG_IMG;
                },

                /* Need to scale the background image for hosts more
                 * than the one for switches because of the shape */
                'background-width': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? '80%' : '70%';
                },

                /* Same for the vertical position */
                'background-position-y': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? '50%' : '60%';
                },

                /* Same for the height */
                'background-height': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? '80%' : '70%';
                },

                /* Change border color by background color */
                'border-color': function(ele) {
                    return (ele.data('type') == NODE_SWITCH) ? SWITCH_BORDER_COLOR : HOST_BORDER_COLOR;
                },

                /* The rest of the config is constant */
                'border-width': 5,
                'border-opacity': 0.6,
                'font-family': 'FontAwesome',
                'font-style': 'normal',
                'font-size': '20',
                'text-valign': 'bottom',
                'text-wrap': 'wrap',
                'height': 64,
                'width': 64
            })
            /* Edge CSS */
            .selector('edge').css({
                'width': function (ele) {
                    /* Loop to find the link speed */
                    for (var i = 0; i < capacities.length; i++) {
                        if (capacities[i].dpid == ele.data('source') && capacities[i].port == ele.data('source_port')) {
                            return scaleCapacity(parseInt(capacities[i]['link-speed-bits-per-second']));
                        }
                    }

                    /* If it wasn't found or statistics collection was not
                     * enabled then we can return a default value */
                    return DEFAULT_EDGE_WIDTH;
                },
                'line-color': function(ele) {
                    /* If the link is blocked we don't care */
                    if (ele.data('blocked')) {
                        return BLOCKED_EDGE_COLOR;
                    }

                    /* Loop to find the link speed */
                    for (var i = 0; i < capacities.length; i++) {
                        if (capacities[i].dpid == ele.data('source') && capacities[i].port == ele.data('source_port')) {
                            var cap = parseInt(capacities[i]['link-speed-bits-per-second']) * 1000;
                            var bw = parseInt(capacities[i]["bits-per-second-rx"]) + parseInt(capacities[i]["bits-per-second-tx"]);
                            return scaleColor(cap, bw);
                        }
                    }

                    /* If it wasn't found or statistics collection was not
                     * enabled then we can return a default value */
                    return DEFAULT_EDGE_COLOR;
                },
                'opacity': function(ele) {
                    if (ele.data('blocked')) {
                        return BLOCKED_EDGE_OPACITY;
                    }

                    return DEFAULT_EDGE_OPACITY;
                }
             })
             /* CSS for flow path visualization */
             .selector('node.not-path').css({
                 'opacity': 0.3,
                 'z-index': 0
             })
             .selector('node.path').css({
                 'opacity': 1,
                 'z-index': 1
             })
             .selector('edge.not-path').css({
                 'opacity': 0.1,
                 'z-index': 0
             })
             .selector('edge.path').css({
                 'opacity': DEFAULT_EDGE_OPACITY,
                 'z-index': 1
             }),

        /* Viewport settings */
        minZoom: 0.5,
        maxZoom: 5,
        wheelSensitivity: 0.2,
        boxSelectionEnabled: true,
        ready: function() {}
    });

    /* Allow the pop-up HTML pages access to the cytoscape graph */
    top.cyto = cyto;

    /* Add our pop-ups on the switches, hosts, and edges */
    cyto.on("tap", "node[type = 'SWITCH']", function(event) {
        return switchQTIP(event)
    });
    cyto.on("tap", "node[type = 'HOST']", function(event) {
        return hostQTIP(event);
    });
    cyto.on("tap", "edge", function(event) {
        return edgeQTIP(event)
    });

    /* Run our layout configuration */
    cyto.layout({
        name: 'cose',
        gravity: -10,
        initialTemp: 100000,
        nodeRepulsion: function(node) {return 100000;},
        fit: true
    }).run();
}

/**
 * Loads the statistics data into the cache variable. If statistics is
 * not enabled the cache will be set to an empty list.
 *
 * @return Promise object for the ajax query
 */
function loadStatisticsData() {
    return $.ajax({
        url: "http://" + ip + ":" + port + "/wm/statistics/bandwidth/all/all/json",

        /* Set the cache to the statistics data */
        dataType: "json",
        success: function(data) {
            capacities = data;
        }
    });
}

/**
 * Loads the switches from the controller and adds them to the cytoscape graph.
 *
 * @return Promise object for the ajax query
 */
function loadSwitches() {
    return $.ajax({
        url: "http://" + ip + ":" + port + "/wm/core/controller/switches/json",

        /* On success add each switch as a node in the graph */
        success: function (data) {
            /* Add all the nodes returned into the list of nodes */
            for (var i = 0; i < data.length; i++) {
                nodes.push({
                    data: {
                        id: data[i]["switchDPID"],
                        name: data[i]["switchDPID"],
                        type: NODE_SWITCH
                    }
                });
            }
        }
    });
}

/**
 * Loads all the links between switches which are defined as an
 * "internal" link.
 *
 * @return Promise object for the ajax query
 */
function loadInternalLinks() {
    return $.ajax({
        url: "http://" + ip + ":" + port + "/wm/topology/links/json",

        /* If we can get the data from the REST API */
        success: function (links) {
            /* For each link we need to add an edge between the switches */
            for (var i = 0; i < links.length; i++) {
                edges.push({
                    data: {
                        id: links[i]["src-switch"] + "_" + links[i]["dst-switch"],
                        source: links[i]["src-switch"],
                        target: links[i]["dst-switch"],
                        source_port: links[i]["src-port"],
                        target_port: links[i]["dst-port"],
                        blocked: false, /* Load links as unblocked by default */
                        blockable: true
                    }
                });
            }
        }
    });
}

/**
 * Loads all the hosts from the controller and adds them to the
 * cytoscape graph.
 *
 * @return Promise object for the ajax query
 */
function loadHosts() {
    return $.ajax({
        url: "http://" + ip + ":" + port + "/wm/device/",

        /* Load all the hosts and all the edges between hosts and switches */
        success: function (hosts) {
            var hosts = hosts.devices;
            for (var i = 0; i < hosts.length; i++) {
                /* Only add the host if it has a link to a switch in the network */
                if (hosts[i]["attachmentPoint"].length > 0) {
                    nodes.push({
                        data: {
                            id: hosts[i]["mac"][0],
                            name: hosts[i]["mac"][0],
                            type: NODE_HOST
                        }
                    });
                }

                /* Parse all the links between hosts and switches */
                var attachments = hosts[i]['attachmentPoint'];
                for (var j = 0; j < attachments.length; j++) {
                    edges.push({
                        data: {
                            id: attachments[j]["switch"] + "_" + hosts[i]["mac"][0],
                            source: hosts[i]["mac"][0],
                            target: attachments[j]["switch"],
                            blocked: false,
                            blockable: false
                        }
                    });
                }
            }
        }
    });
}

/**
 * Loads all of the blocked links and sets their colours to gray.
 *
 * @return Promise object for the ajax query
 */
function loadBlockedLinks() {
    return $.ajax({
        url: "http://" + ip + ":" + port + "/wm/topology/blockedlinks/json",

        /* If we can get the data from the REST API */
        success: function (links) {
            /* TODO I broke the shit outa this the REST call doesnt return anything anymore ffs */
            console.log(links);
            /* Need to edit the links to show the block */
            for (var i = 0; i < links.length; i++) {
                var id = links[i]["src-switch"] + "_" + links[i]["dst-switch"];
                cyto.$("edge[id = '" + id + "']").data({
                    blocked: true
                });
             }
        }
    });
}

/**
 * Function to register the tool tip pop-up for switches.
 *
 * @param event The event that triggered the pop-up
 */
function switchQTIP (event) {
    /* Store the switch data path ID from the switch that was clicked */
    $.cookie("curSID", event.target.id(), {expires: 1});

    /* Add the pop-up on the switch that was clicked */
    event.target.qtip({
        /* Load the switch pop-up HTML page and set it in the pop-up
         * container that is created */
        content: function (event, api) {
            $.ajax({
                url: "switchpopup.html",
                dataType: "html",
                success: function(html) {
                    var $html = $('<div/>', {html: html});
                    api.set('content.text', $html.html());
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Error: " + jqXHR.responseText +
                                "\nStatus: " + textStatus +
                                "\nError Thrown: " + errorThrown);
                }
            });
        },
        overwrite: false,
        show: {
            solo: true
        },
        hide: {
            fixed: true,
            when: {
                event: 'click'
            }
        },
        events: {
            /* When told to hide, we should just destroy the pop-up so we can
             * re-create it later (so that DataTable does not complain) */
            hide: function(event, api) {
                api.destroy(true);
            }
        },
        position: {
            my: 'bottom center',
            at: 'top center'
        },
        style: {
            classes: 'qtip-bootstrap qtip-switch',
            tip: {
                width: 16,
                height: 8
            }
        }
    }, event);
}

/**
 * Function to register the tool tip pop-up for the hosts.
 *
 * @param event The event that triggered the pop-up
 */
function hostQTIP(event) {
    /* Store the MAC of the host for the pop-up to use */
    $.cookie("popupMAC", event.target.id(), {expires: 1});

    event.target.qtip({
        content: function (event, api) {
            /* Load the popup HTML and set it in the QTIP window */
            $.ajax({
                url: "hostpopup.html",
                dataType: "html",
                success: function(html) {
                    /* Parse HTML string into real HTML and add it to window */
                    var $html = $('<div/>', {html: html});
                    api.set('content.text', $html.html());
                }
            });
        },

        /* If there was an error log */
        error: function (jqXHR, textStatus, errorThrown) {
            console.log("Error: " + jqXHR.responseText +
                        "\nStatus: " + textStatus +
                        "\nError Thrown: " + errorThrown);
        },
        overwrite: false,
        show: {
            solo: true
        },
        hide: {
            fixed: true,
            when: {
                event: 'click'
            }
        },
        events: {
            /*
            * When told to hide, we should just destroy the pop-up so we can
            * re-create it later (so that DataTable does not complain)
            */
            hide: function(event, api) {
                api.destroy(true);
            }
        },
        position: {
            my: 'bottom center',
            at: 'top center'
        },
        style: {
            classes: 'qtip-bootstrap qtip-host',
            tip: {
                width: 16,
                height: 8
            }
        }
    }, event);
}

/**
 * Function to register the tool tip pop-up for the links.
 *
 * @param event The event that triggered the pop-up
 */
function edgeQTIP(event) {
    /* Use the data stored on the edge to set the values
     * for the source and destination addresses */
    $.cookie("popupLinkSrc", event.target.data("source"), {expires: 1});
    $.cookie("popupLinkDst", event.target.data("target"), {expires: 1});
    $.cookie("popupLinkSrcPort", event.target.data("source_port"), {expires: 1});
    $.cookie("popupLinkDstPort", event.target.data("target_port"), {expires: 1});
    $.cookie("popupLinkBlockable", event.target.data("blockable"), {expires: 1});

    event.target.qtip({
        content: function (event, api) {
            $.ajax({
                url: 'linkpopup.html',
                dataType: "html",
                success: function(html) {
                    /* Parse HTML string into real HTML and add it to window */
                    var $html = $('<div/>', {html: html});
                    api.set('content.text', $html.html());
                }
            });
        },
        show: {
            solo: true
        },
        hide: {
            fixed: true,
            when: {
                event: 'click'
            }
        },
        events: {
            /* When told to hide, we should just destroy the pop-up so we can
             * re-create it later (so that DataTable does not complain) */
            hide: function(event, api) {
                api.destroy(true);
            }
        },
        position: {
            my: 'bottom center',
            at: 'top center'
        },
        style: {
            classes: 'qtip-bootstrap qtip-link',
            tip: {
                width: 16,
                height: 8
            }
        }
    }, event);
}

/**
 * Returns a scaled width for the edge using the capacity of the link.
 *
 * @param capacity The capacity of the link to scale to a width
 */
function scaleCapacity(capacity) {
    return 8 + Math.log10(capacity);
}

/**
 * Returns the color to display on the link based on the current bandwidth
 * being used and the total capacity of the link.
 *
 * @param capacity Total capacity of the link
 * @param bandwidth Current bandwidth being used
 */
function scaleColor(capacity, bandwidth) {
    /* Find the current usage */
    var usage = bandwidth / capacity;

    /* If the usage is below 30% we are just going to ignore it */
    if (usage <= 0.3) {
        return DEFAULT_EDGE_COLOR;
    }

    /* Technically possible and would crash the GUI so limit it */
    if (usage > 1) {
        usage = 1;
    }

    /* Use linear function to calculate the amount of red in the link */
    var red = Math.ceil((364.3 * usage) - 109.3).toString(16);

    /* Need to prepend a zero if we only have single digit */
    if (red.length == 1) {
        red = "0" + red;
    }

    return "#" + red + "0000";
}
