/**
 * Formats the size and units of a given speed quantity and returns the
 * string representation.
 *
 * @param{int} bytes - Speed to format
 */
 function formatSpeed(bytes) {
     if (bytes >= 1000000000) {
         bytes = (bytes / 1000000000).toFixed(2) + ' Gbps';
     }
     else if (bytes >= 1000000) {
         bytes = (bytes / 1000000).toFixed(2) + ' Mbps';
     }
     else if (bytes >= 1000) {
         bytes = (bytes / 1000).toFixed(2) + ' Kbps';
     }
     else if (bytes > 1) {
         bytes = bytes + ' bps';
     }
     else if (bytes == 1) {
         bytes = bytes + ' bps';
     }
     else {
         bytes = '0 bps';
     }
     return bytes;
 }

/**
* Formats the size and the units of a given quantity of bytes and returns
* the string representation.
*
* @param{int} bytes - Byte count to format
*/
function formatSize(bytes) {
    if (bytes >= 1000000000) {
        bytes = (bytes / 1000000000).toFixed(2) + ' GB';
    }
    else if (bytes >= 1000000) {
        bytes = (bytes / 1000000).toFixed(2) + ' MB';
    }
    else if (bytes >= 1000) {
        bytes = (bytes / 1000).toFixed(2) + ' KB';
    }
    else if (bytes > 1) {
        bytes = bytes + ' bytes';
    }
    else if (bytes == 1) {
        bytes = bytes + ' byte';
    }
    else {
        bytes = '0 bytes';
    }
    return bytes;
}
