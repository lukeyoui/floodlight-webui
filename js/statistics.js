var ipaddress = $.cookie('cip');
if (ipaddress == null || ipaddress == "") window.location.href = "login.html";
var restport = $.cookie('cport');
if (restport == null || restport == "") window.location.href = "login.html";

$("#collectionChange").click(function () {

});

function OpenStatistic() {
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

        },
        error  : function (jqXHR, textStatus, errorThrown) {
            alert('Error: ' + " " + jqXHR.responseText + " \n Status: " + textStatus + " \n Error Thrown: " + errorThrown);
        }
    });
}

function CloseStatistic() {
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
        },
        error   : function (jqXHR, textStatus, errorThrown) {
            alert('Error: ' + " " + jqXHR.responseText + " \n Status: " + textStatus + " \n Error Thrown: " + errorThrown);
        }
    });
}

var ctx = document.getElementById('linkChart').getContext('2d');
var chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ["14/02/18 11:01", "14/02/18 11:02", "14/02/18 11:03", "14/02/18 11:04", "14/02/18 11:05", "14/02/18 11:06", "14/02/18 11:07"],
        datasets: [{
            label: "00:00:00:00:00:01/00:00:00:00:00:02",
            backgroundColor: 'rgb(255, 99, 132, 0.1)',
            borderColor: 'rgb(255, 99, 132)',
            data: [0, 10, 5, 2, 20, 30, 45],
        },
        {
            label: "00:00:00:00:00:02/00:00:00:00:00:03",
            backgroundColor: 'rgb(0, 99, 132, 0.1)',
            borderColor: 'rgb(0, 99, 132)',
            data: [5, 4, 10, 7, 11, 2, 1],
        }]
    }
});

var octx = document.getElementById('flowChart').getContext('2d');
var ochart = new Chart(octx, {
    type: 'doughnut',
    data: {
            datasets: [{
                backgroundColor: ["#3e95cd", "#8e5ea2","#3cba9f"],
                data: [10, 2, 30]
            }],

            // These labels appear in the legend and in the tooltips when hovering different arcs
            labels: [
                'ICMP',
                'UDP',
                'RTP'
            ]
    }
});
