var kv = require('../index'),
    assert = require('assert');

// TEST DATA
var simple_object = {a : 1},
    complex_object = {
        name: "Some Name",
        age: 30,
        location: [1.34, 5.53],
        obj: simple_object,
        married: false,
        working: true,
        interests: [
            {
                title: "Some 1",
                num: 1
            },
            {
                title: "Some 2",
                num: 1
            }
        ]
    },
    complex_object_encoded = '"name" "Some Name"\n"age" 30\n"location" [\n\t1.34\n\t5.53\n]\n"obj" {\n\t"a" 1\n\n}\n"married" false\n"working" true\n"interests" [\n\t{\n\t\t"title" "Some 1"\n\t\t"num" 1\n\t}\n\t{\n\t\t"title" "Some 2"\n\t\t"num" 1\n\t}\n]\n',
    complex_object_encoded_compact = 'name"Some Name"age 30 location[1.34 5.53]obj{a 1}married false working true interests[{title"Some 1"num 1}{title"Some 2"num 1}]';


exports['test KeyValue#decode'] = function () {
    assert.eql(simple_object, kv.decode('a 1\n'));
    // FIXME: Failing right now
    //assert.eql(simple_object, kv.decode('a 1'));
};

exports['test KeyValue#encode'] = function () {
    assert.eql(complex_object_encoded, kv.encode(complex_object));
    assert.eql(complex_object_encoded_compact, kv.encode(complex_object, true));
};