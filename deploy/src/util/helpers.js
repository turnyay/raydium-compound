
export function byteArrayToString(array) {
    return String.fromCharCode.apply(String, array);
}

export function stringToByteArray(str, length) {
    if (str.length > length) {
        console.log("Unable to get byte array, length greater than " + length);
        return null;
    }
    var byteArray = [];
    for (var i = 0; i < length; i++) {
        if (i < str.length) {
            var code = str.charCodeAt(i);
        } else {
            var code = 32;  // use space as filler
        }
        byteArray = byteArray.concat([code]);
    }
    return byteArray;
};

export function byteArrayToLong(byteArray) {
    var value = 0;
    for ( var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }
    return value;
};

export function longToByteArray(long) {
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = long & 0xff;
        byteArray [ index ] = byte;
        long = (long - byte) / 256 ;
    }
    return byteArray;
};
