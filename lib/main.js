 /* Copyright (C) 2010 by Matheus Valadares
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
/**
 *	KeyValue
 *
 *	Implementation Ver. 1.3
 *
 *	@author Matheus28
 */
var KeyValue = {};

function KeyValueDecoder(){
	var self = this;
	var root;
	var depths;
	var depth;
	var inString;
	var stringType;
	var building;
	var curKey;
	
	
	this.onInit = function(){
		depths = [];
		depth = 0;
		inString = false;
		stringType = 0;
		building = "";
		curKey = null;
		
		depths.push( { } );
	}
	
	this.onKeyValue = function(key, value){
		depths[depth][key] = value;
	}
	
	this.onValue = function(value){
		depths[depth].push(value);
	}
	
	this.onBlock = function(key, type){
		++depth;
		switch(type){
			case 0:
				depths.push( { } );
			break;
			case 1:
				depths.push( [ ] );
			break;
			default: throw new Error("Unknown block type: "+type);
		}
	}
	
	this.onEndBlock = function(key, type){
		var d = --depth;
		switch(KeyValue.parserGetParentType()) {
			case 0:
				var obj = depths.pop();
				depths[d][key] = obj;
			break;
			case 1:
				depths[d].push(depths.pop());
			break;
			default: throw new Error("Unknown block type: "+type);
		}
	}
	
	this.onFinish = function(){
		root = depths[0];
		self.root = root;
	}
}

KeyValueDecoder.prototype={
	root:null
}

KeyValue.parserGetParentType = null;
var decoder = new KeyValueDecoder();

KeyValue.decode = function(code){
	KeyValue.parse(code, decoder);
	return decoder.root;
}

KeyValue.parse = function(code, parser){
	var depthsKey = [];
	var depthsType = [];
	var depth = -1;
	var inString = false;
	var stringType = 0;
	var building = "";
	var curKey = null;
	var keyLine = 0;
	var lineCount = 1;
	var tmpStr;
	
	KeyValue.parserGetParentType = function() {
		if(depth == 0) return 0;
		return depthsType[depth - 1];
	}
	
	depthsKey.push("");
	depthsType.push(0);
	++depth;
	
	parser.onInit();
	
	for(var i = 0; i < code.length;++i) {
		var ch = code.charAt(i);
		if(inString) {
			if(ch == "\\") {
				if(i == code.length - 1) {
					throw new Error("Cannot escape nothing at line "+lineCount);
				}
				switch(code.charAt(i + 1)) {
					case '"':
						building += '"';
					break;
					case "'":
						building += "'";
					break;
					case 'n':
						building += '\n';
					break;
					case 'r':
						building += '\r';
					break;
					default:
						throw new Error("Invalid escape character at line "+lineCount);
				}
				++i;
			}else if((ch == "\"" && stringType==0)
				|| (ch == "'" && stringType==1)
				|| (stringType==2 && !isCharSimple(ch))
			) {
				if(depthsType[depth] == 0) {
					if(curKey == null) {
						curKey = building;
						keyLine = lineCount;
					}else {
						if(keyLine != lineCount) {
							throw new Error("Key must be on the same line of the value at line "+keyLine);
						}
						if(stringType == 2) {
							if(isNumeric(building)){
								parser.onKeyValue(curKey, Number(building));
							}else if(isStringKeyword(building)) {
								parser.onKeyValue(curKey, keywordToValue(building));
							}else{
								parser.onKeyValue(curKey, building);
							}
						}else{
							parser.onKeyValue(curKey, building);
						}
						curKey = null;
					}
				}else if(depthsType[depth] == 1) {
					if(isNumeric(building)) {
						parser.onValue(Number(building));
					}else {
						parser.onValue(building);
					}
				}
				inString = false;
				if(stringType==2){
					--i;
				}
			}else {
				building += ch;
			}
		}else if(ch == "\"") {
			inString = true;
			stringType = 0;
			building = "";
		}else if(ch == "'") {
			inString = true;
			stringType = 1;
			building = "";
		}else if(ch == '{') {
			if(depthsType[depth]==0){
				if(curKey == null) throw new Error("Block must have a key at line "+lineCount+" offset "+i);
			}
			
			parser.onBlock(curKey, 0);
			
			depthsKey.push(curKey);
			depthsType.push(0);
			
			curKey = null;
			++depth;
			
		}else if(ch == '}') {
			if(depth == 0) throw new Error("Block mismatch at line " + lineCount);
			if(depthsType[depth]!=0) throw new Error("Block mismatch at line " + lineCount + ' (Expected block type '+depthsType[depth]+')');
			
			
			tmpStr = depthsKey.pop();
			
			parser.onEndBlock(tmpStr, 0);
			
			depthsType.pop();
			
			--depth;
		}else if(ch == '[') {
			if(depthsType[depth]==0){
				if(curKey == null) throw new Error("Block must have a key at line " + lineCount);
			}
			
			parser.onBlock(curKey, 1);
			
			depthsKey.push(curKey);
			depthsType.push(1);
			
			curKey = null;
			++depth;
		}else if(ch == ']') {
			if(depth == 0) throw new Error("Block mismatch at line " + lineCount);
			if(depthsType[depth] != 1) throw new Error("Block mismatch at line " + lineCount);
			
			
			tmpStr = depthsKey.pop();
			
			parser.onEndBlock(tmpStr, 1);
			
			depthsType.pop();
			
			--depth;
		}else if(ch=='\n' || ch=='\r' || ch==' ' || ch=='\t') {
			if(ch == '\n') {
				++lineCount;
			}
			continue;
		}else if(ch == '/' && code.charAt(i + 1) == '/') {
			while(i < code.length && code.charAt(i) != '\n') {
				++i;
			}
			if(code.charAt(i) == '\n') {
				--i;
			}
		}else if(ch == '/' && code.charAt(i + 1) == '*') {
			++i;
			while(true) {
				++i;
				ch = code.charAt(i);
				if(ch == '*' && code.charAt(i + 1) == '/') {
					++i;
					break;
				}else if(ch == '\n') {
					++lineCount;
				}else if(i >= code.length) {
					throw new Error("Comment block is not closed at line "+lineCount);
				}
			}
		}else {
			inString = true;
			stringType = 2;
			building = "";
			--i;
		}
	}
	
	if(curKey != null) {
		throw new Error("Key \""+curKey+"\" doesn't have a value");
	}
	
	parser.onFinish();
	
	parserGetParentType = null;
}

KeyValue.encode = function(obj, compact){
	if(compact) {
		return encodeC(obj, 0);
	}else {
		return encodeP(obj, 0);
	}
}

function encodeP(obj, depth){
	var str = "";
	for(var i in obj) {
		if(obj[i].constructor == Function) continue;
		str += encodePKV(i, obj[i], depth, obj);
	}
	return str;
}

function encodePA(arr, depth){
	var str = "\n";
	var dp = ms('\t', depth);
	for(var i = 0; i < arr.length;++i) {
		if(isObjectKeyword(arr[i])) {
			str += dp + keywordToString(arr[i]) + '\n';
		}else if(supported(arr[i])) {
			if(arr[i].constructor == Number) {
				str += dp + arr[i] + '\n';
			}else{
				str += dp + '"' + String(arr[i]).replace(/"/gm, '\\"') + '"\n';
			}
		}else if(arr[i].constructor == Array){
			str += dp + '[' + encodePA(arr[i], depth + 1) + dp + ']\n';
		}else {
			str += dp+'{\n' + encodeP(arr[i], depth + 1) + dp + '}\n';
		}
	}
	return str;
}

function encodePKV(key, value, depth, origObj){
	if(value == origObj) return '';
	var dp = ms('\t', depth);
	if(isObjectKeyword(value)) {
		return dp + '"' + key + '" ' + keywordToString(value) + '\n';
	}else if(supported(value)) {
		if(value.constructor == Number) {
			return dp + '"' + key + '" ' + value + '\n';
		}else{
			return dp + '"' + key + '" "' + String(value).replace(/"/gm, '\\"') + '"\n';
		}
	}else if(value.constructor == Array) {
		return dp + '"' + key + '" [' + encodePA(value, depth + 1) + dp + ']\n';
	}else {
		return dp + '"' + key + '" {\n' + encodeP(value, depth + 1) + '\n' + dp + '}\n';
	}
}

////

function encodeC(obj, depth){
	var str = "";
	var ch = "";
	for(var i in obj) {
		if(obj[i].constructor == Function) continue;
		str += encodeCKV(ch, i, obj[i], depth, obj);
		ch = str.charAt(str.length - 1);
	}
	return str;
}

function encodeCA(arr, depth){
	var str = "";
	for(var i = 0; i < arr.length;++i) {
		if(isObjectKeyword(arr[i])) {
			str += (i==0?'':' ')+keywordToString(arr[i]);
		}else if(supported(arr[i])) {
			if(arr[i].constructor == Number) {
				str += (i==0?'':' ')+Number(arr[i]).toString(10);
			}else{
				var tmp = String(arr[i]).replace(/"/gm, '\\"');
				if(isSimple(tmp)){
					str += (i==0?'':' ')+tmp;
				}else {
					str += '"'+tmp+'"';
				}
			}
		}else if(arr[i].constructor == Array) {
			str += '[' + encodeCA(arr[i], depth + 1) + ']';
		}else {
			str += '{' + encodeC(arr[i], depth + 1) + '}';
		}
	}
	return str;
}

function encodeCKV(ch, key, value, depth, origObj){
	if(value == origObj) return '';
	var str = '';
	if(isCharSimple(ch)) str = ' ';
	if(isObjectKeyword(value)) {
		if(isSimple(key)) {
			str += key + ' ' + keywordToString(value);
		}else {
			str += '"' + key + '"' + keywordToString(value);
		}
	}else if(supported(value)) {
		if(value.constructor == Number) {
			if(isSimple(key)) {
				str += key + ' ' + value;
			}else {
				str += '"' + key + '"' + value;
			}
		}else{
			var tmp = String(value).replace(/"/gm, '\\"');
			if(isSimple(key)) {
				if(isSimple(tmp)) {
					str += key + ' ' + tmp;
				}else {
					str += key + '"' + tmp + '"';
				}
			}else {
				if(isSimple(value)) {
					str += '"' + key + '"' + tmp;
				}else{
					str += '"' + key + '""' + tmp + '"';
				}
			}
		}
	}else if(value.constructor == Array) {
		if(isSimple(key)) {
			str += key + '[' + encodeCA(value, depth+1) + ']';
		}else{
			str += '"' + key + '"[' + encodeCA(value, depth+1) + ']';
		}
	}else {
		if(isSimple(key)) {
			str += key + '{' + encodeC(value, depth + 1) + '}';
		}else {
			str += '"' + key + '"{' + encodeC(value, depth + 1) + '}';
		}
	}
	return str;
}

function isSimple(key){
	if(key.length == 0) return false;
	if(isStringKeyword(key)) return false;
	for(var i = 0; i < key.length;++i) {
		var ch = key.charAt(i);
		switch(ch) {
			case ' ':
			case '\t':
			case '\n':
			case '\r':
			case '[':
			case ']':
			case '{':
			case '}':
			case '"':
			case '\'':
			case '\\':
			return false;
		}
	}
	return true;
}

function isCharSimple(ch){
	switch(ch) {
		case '':
		case ' ':
		case '\t':
		case '\n':
		case '\r':
		case '[':
		case ']':
		case '{':
		case '}':
		case '"':
		case '\'':
		case '\\':
		return false;
	}
	return true;
}

function isObjectKeyword(obj){
	if(obj.constructor == Boolean) return true;
	if(obj == null) return true; // This one covers null and undefined
	return false;
}

function isStringKeyword(str){
	switch(str) {
		case 'true': return true;
		case 'false': return true;
		case 'null': return true;
	}
	return false;
}

function keywordToValue(str){
	switch(str) {
		case 'true': return true;
		case 'false': return false;
		case 'null': return null;
	}
	return null;
}

function keywordToString(obj){
	return String(obj);
}

function isNumeric(str){
	return (/^[\-0-9.]+$/).test(str);
}

function supported(obj){
	if(obj.constructor == String) return true;
	if(obj.constructor == Number) return true;
	
	return false;
}

function ms(str, times){
	var r = "";
	for(var i = 0; i < times;++i) r += str;
	return r;
}

module.exports = KeyValue;
