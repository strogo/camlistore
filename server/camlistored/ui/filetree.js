/*
Copyright 2011 The Camlistore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @fileoverview Filetree page.
 *
 */
goog.provide('camlistore.FiletreePage');

goog.require('goog.dom');
goog.require('goog.events.EventType');
goog.require('goog.ui.Component');
goog.require('camlistore.ServerConnection');

/**
 * @param {camlistore.ServerType.DiscoveryDocument} config Global config
 *   of the current server this page is being rendered for.
 * @param {goog.dom.DomHelper=} opt_domHelper DOM helper to use.
 *
 * @extends {goog.ui.Component}
 * @constructor
 */
camlistore.FiletreePage = function(config, opt_domHelper) {
	goog.base(this, opt_domHelper);

	/**
	 * @type {Object}
	 * @private
	 */
	this.config_ = config;

	/**
	 * @type {camlistore.ServerConnection}
	 * @private
	 */
	this.connection_ = new camlistore.ServerConnection(config);

};
goog.inherits(camlistore.FiletreePage, goog.ui.Component);


/**
 * @type {number}
 * @private
 */
camlistore.FiletreePage.prototype.indentStep_ = 20;


function getDirBlobrefParam() {
	var blobRef = getQueryParam('d');
	return (blobRef && isPlausibleBlobRef(blobRef)) ? blobRef : null;
}

// Returns the first value from the query string corresponding to |key|.
// Returns null if the key isn't present.
getQueryParam = function(key) {
	var params = document.location.search.substring(1).split('&');
	for (var i = 0; i < params.length; ++i) {
		var parts = params[i].split('=');
		if (parts.length == 2 && decodeURIComponent(parts[0]) == key)
			return decodeURIComponent(parts[1]);
	}
	return null;
};

// Returns true if the passed-in string might be a blobref.
isPlausibleBlobRef = function(blobRef) {
	return /^\w+-[a-f0-9]+$/.test(blobRef);
};


/**
 * Called when component's element is known to be in the document.
 */
camlistore.FiletreePage.prototype.enterDocument = function() {
	camlistore.FiletreePage.superClass_.enterDocument.call(this);
	var blobref = getDirBlobrefParam();

	if (blobref) {
		this.connection_.describeWithThumbnails(
			blobref,
			0,
			goog.bind(this.handleDescribeBlob_, this, blobref),
			function(msg) {
				alert("failed to get blob description: " + msg);
			}
		);
	}
}

/**
 * @param {string} blobref blob to describe.
 * @param {camlistore.ServerType.DescribeResponse} describeResult Object of properties for the node.
 * @private
 */
camlistore.FiletreePage.prototype.handleDescribeBlob_ =
function(blobref, describeResult) {
	var meta = describeResult.meta;
	if (!meta[blobref]) {
		alert("didn't get blob " + blobref);
		return;
	}
	var binfo = meta[blobref];
	if (!binfo) {
		alert("Error describing blob " + blobref);
		return;
	}
	if (binfo.camliType != "directory") {
		alert("Does not contain a directory");
		return;
	}
	this.connection_.getBlobContents(
		blobref,
		goog.bind(function(data) {
			var finfo = JSON.parse(data);
			var fileName = finfo.fileName;
			var curDir = document.getElementById('curDir');
			curDir.innerHTML = "<a href='./?b=" + blobref + "'>" + fileName + "</a>";
			this.buildTree_();
		}, this),
		function(msg) {
			alert("failed to get blobcontents: " + msg);
		}
	);
}

/**
 * @private
 */
camlistore.FiletreePage.prototype.buildTree_ = function() {
	var blobref = getDirBlobrefParam();
	var children = goog.dom.getElement("children");
	this.connection_.getFileTree(blobref,
		goog.bind(function(jres) {
			this.onChildrenFound_(children, 0, jres);
		}, this)
	);
}

/**
 * @param {string} div node used as root for the tree
 * @param {number} depth how deep we are in the tree, for indenting
 * @param {camlistore.ServerType.DescribeResponse} jres describe result
 * @private
 */
camlistore.FiletreePage.prototype.onChildrenFound_ =
function(div, depth, jres) {
	var indent = depth * camlistore.FiletreePage.prototype.indentStep_;
	div.innerHTML = "";
	for (var i = 0; i < jres.children.length; i++) {
		var children = jres.children;
		var pdiv = goog.dom.createElement("div");
		var alink = goog.dom.createElement("a");
		alink.style.paddingLeft=indent + "px"
		alink.id = children[i].blobRef;
		switch (children[i].type) {
		case 'directory':
			goog.dom.setTextContent(alink, "+ " + children[i].name);
			goog.events.listen(alink,
				goog.events.EventType.CLICK,
				goog.bind(function (b, d) {
					this.unFold_(b, d);
				}, this, alink.id, depth),
				false, this
			);
			break;
		case 'file':
			goog.dom.setTextContent(alink, "  " + children[i].name);
			alink.href = "./?b=" + alink.id;
			break;
		default:
			alert("not a file or dir");
			break;
		}
		var newPerm = goog.dom.createElement("span");
		newPerm.className = "cam-filetree-newp";
		goog.dom.setTextContent(newPerm, "P");
		goog.events.listen(newPerm,
			goog.events.EventType.CLICK,
			this.newPermWithContent_(alink.id),
			false, this
		);
		goog.dom.appendChild(pdiv, alink);
		goog.dom.appendChild(pdiv, newPerm);
		goog.dom.appendChild(div, pdiv);
	}
}


/**
 * @param {string} content blobref of the content
 * @private
 */
camlistore.FiletreePage.prototype.newPermWithContent_ =
function(content) {
	var fun = function(e) {
		this.connection_.createPermanode(
			goog.bind(function(permanode) {
				this.connection_.newAddAttributeClaim(
					permanode, "camliContent", content,
					function() {
						alert("permanode created");
					},
					function(msg) {
						// TODO(mpl): "cancel" new permanode
						alert("set permanode content failed: " + msg);
					}
				);
			}, this),
			function(msg) {
				alert("create permanode failed: " + msg);
			}
		);
	}
	return goog.bind(fun, this);
}


/**
 * @param {string} blobref dir to unfold.
 * @param {number} depth so we know how much to indent.
 * @private
 */
camlistore.FiletreePage.prototype.unFold_ =
function(blobref, depth) {
	var node = goog.dom.getElement(blobref);
	var div = goog.dom.createElement("div");
	this.connection_.getFileTree(blobref,
		goog.bind(function(jres) {
			this.onChildrenFound_(div, depth+1, jres);
			insertAfter(node, div);
			goog.events.removeAll(node);
			goog.events.listen(node,
				goog.events.EventType.CLICK,
				goog.bind(function(b, d) {
					this.fold_(b, d);
				}, this, blobref, depth),
				false, this
			);
		}, this)
	);
}

function insertAfter( referenceNode, newNode ) {
	// nextSibling X2 because of the "P" span
	referenceNode.parentNode.insertBefore( newNode, referenceNode.nextSibling.nextSibling );
}

/**
 * @param {string} nodeid id of the node to fold.
 * @param {depth} depth so we know how much to indent.
 * @private
 */
camlistore.FiletreePage.prototype.fold_ =
function(nodeid, depth) {
	var node = goog.dom.getElement(nodeid);
	// nextSibling X2 because of the "P" span
	node.parentNode.removeChild(node.nextSibling.nextSibling);
	goog.events.removeAll(node);
	goog.events.listen(node,
		goog.events.EventType.CLICK,
		goog.bind(function(b, d) {
			this.unFold_(b, d);
		}, this, nodeid, depth),
		false, this
	);
}

