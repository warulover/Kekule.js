/**
 * @fileoverview
 * Object modifier to change property of atoms (and other similar chem nodes) in chem editor.
 * @author Partridge Jiang
 */

/*
 * requires /lan/classes.js
 * requires /utils/kekule.utils.js
 * requires /widgets/kekule.widget.base.js
 * requires /widgets/commonCtrls/kekule.widget.buttons.js
 * requires /widgets/chem/editor/kekule.chemEditor.baseEditor.js
 * requires /widgets/chem/editor/kekule.chemEditor.objModifiers.js
 * requires /widgets/chem/editor/kekule.chemEditor.utilWidgets.js
 */

(function(){
"use strict";

var AU = Kekule.ArrayUtils;
var DU = Kekule.DomUtils;
var EU = Kekule.HtmlElementUtils;
var CNS = Kekule.Widget.HtmlClassNames;
var CCNS = Kekule.ChemWidget.HtmlClassNames;
var BNS = Kekule.ChemWidget.ComponentWidgetNames;

Kekule.ChemWidget.HtmlClassNames = Object.extend(Kekule.ChemWidget.HtmlClassNames, {
	COMPOSER_ATOM_MODIFIER_BUTTON: 'K-Chem-Composer-AtomModifier-Button',
	COMPOSER_ATOM_MODIFIER_DROPDOWN: 'K-Chem-Composer-AtomModifier-DropDown',
	COMPOSER_BOND_MODIFIER_BUTTON: 'K-Chem-Composer-BondModifier-Button',
	COMPOSER_BOND_MODIFIER_DROPDOWN: 'K-Chem-Composer-BondModifier-DropDown'
});

/**
 * A atom modifier to change the atom property of chem nodes.
 * @class
 * @augments Kekule.Editor.ObjModifier.Base
 */
Kekule.Editor.ObjModifier.Atom = Class.create(Kekule.Editor.ObjModifier.Base,
/** @lends Kekule.Editor.ObjModifier.Atom# */
{
	/** @private */
	CLASS_NAME: 'Kekule.Editor.ObjModifier.Atom',
	/** @private */
	initProperties: function()
	{
		// private
		this.defineProp('atomSetter', {
			'dataType': 'Kekule.Widget.BaseWidget', 'serializable': false, 'setter': null
		});
	},
	/** @ignore */
	doCreateWidget: function()
	{
		var result = new Kekule.Widget.DropDownButton(this.getEditor());
		result.setHint(Kekule.$L('ChemWidgetTexts.HINT_ATOM_SETTER'));
		result.setText(Kekule.$L('ChemWidgetTexts.CAPTION_ATOM_SETTER'));
		result.setShowText(true);
		result.setButtonKind(Kekule.Widget.Button.Kinds.DROPDOWN);
		result.addClassName(CCNS.COMPOSER_ATOM_MODIFIER_BUTTON);

		var atomSetter = this._createAtomSetter(this.getEditor());
		this.setPropStoreFieldValue('atomSetter', atomSetter);

		result.setDropDownWidget(atomSetter);

		return result;
	},
	/** @private */
	_createAtomSetter: function(parentWidget)
	{
		var editor = this.getEditor();
		var result = new Kekule.ChemWidget.StructureNodeSetter(parentWidget);
		//result.setUseDropDownSelectPanel(true);
		result.addClassName([CNS.PANEL, CCNS.COMPOSER_ATOM_MODIFIER_DROPDOWN, CNS.CORNER_ALL]); // simulate panel outlook
		/*
		if (result.setResizable)
			result.setResizable(true);
		*/

		var listAtoms = AU.clone(this.getEditor().getEditorConfigs().getStructureConfigs().getPrimaryOrgChemAtoms());
		listAtoms.push('...');  // add periodic table item
		// non-atom nodes
		var nonAtomLabelInfos = editor && editor.getEnabledNonAtomInputData && editor.getEnabledNonAtomInputData();

		result.setSelectableInfos({
			'elementSymbols': listAtoms,
			'nonElementInfos': nonAtomLabelInfos,
			'subGroupRepItems': Kekule.Editor.StoredSubgroupRepositoryItem2D.getAllRepItems()
		});

		// react to value change of setter
		var self = this;
		result.addEventListener('valueChange', function(e){
			self.applyToTargets();
			result.dismiss();
		});
		/*
		var self = this;
		result.addEventListener('keyup', function(e)
			{
				var ev = e.htmlEvent;
				if (ev.getKeyCode() === Kekule.X.Event.KeyCode.ENTER)
				{
					self.applySetter(result);
					result.dismiss();  // avoid call apply setter twice
				}
			}
		);
		result.addEventListener('valueSelect', function(e){
			//var data = e.value;
			//console.log(e.target, e.currentTarget);
			if (self.getAtomSetter() && self.getAtomSetter().isShown())
			{
				self.applySetter(result);
				result.dismiss();  // avoid call apply setter twice
			}
		});
		result.addEventListener('showStateChange', function(e)
			{
				if (e.target === result && !e.byDomChange)
				{
					//console.log('show state change', e);
					if (!e.isShown && !e.isDismissed)  // widget hidden, feedback the edited value
					{
						if (self.getAtomSetter() && self.getAtomSetter().isShown())
							self.applySetter(result);
					}
				}
			}
		);
		*/
		return result;
	},
	/** @private */
	_filterStructureNodes: function(targets)
	{
		var nodes = [];
		for (var i = 0, l = targets.length; i < l; ++i)
		{
			var target = targets[i];
			if (target instanceof Kekule.ChemStructureNode)
			{
				/*
				if (target instanceof Kekule.StructureFragment && target.isExpanded())  // expanded group can not be modified
					;
				else
				*/
				nodes.push(target);
			}
		}
		return nodes;
	},
	/** @private */
	_getActualModificationNodes: function(nodes, byPassfilter)
	{
		var result = [];
		for (var i = 0, l = nodes.length; i < l; ++i)
		{
			var node = nodes[i];
			if (node instanceof Kekule.StructureFragment && node.isExpanded())  // actually modify children node in expanded group
			{
				var children = this._getActualModificationNodes(node.getNodes(), true);
				AU.pushUnique(result, children);
			}
			else
				result.push(node);
		}
		if (!byPassfilter)
			result = this._filterStructureNodes(result);
		return result;
	},
	/** @ignore */
	doLoadFromTargets: function(editor, targets)
	{
		// filter chem nodes from targets
		//var nodes = this._filterStructureNodes(targets);
		var nodes = this._getActualModificationNodes(targets);
		this.getAtomSetter().setLabelConfigs(this.getEditor().getRenderConfigs().getDisplayLabelConfigs());
		this.getAtomSetter().setNodes(nodes);
		if (nodes.length)
		{
			var nodeLabel = this.getAtomSetter().getNodeLabel();
			//console.log('update node label', nodeLabel);
		}
		this.getWidget().setText(nodeLabel || Kekule.$L('ChemWidgetTexts.CAPTION_ATOM_SETTER_MIXED'))
				.setShowText(true).setDisplayed(!!nodes.length);
	},
	/** @ignore */
	doApplyToTargets: function($super, editor, targets)
	{
		var data = this.getAtomSetter().getValue();
		var opers = [];
		//var nodes = this._filterStructureNodes(targets);
		var nodes = this._getActualModificationNodes(targets);
		for (var i = 0, l = nodes.length; i < l; ++i)
		{
			var target = nodes[i];
			if (target instanceof Kekule.ChemStructureNode)
			{
				var op = this._createNewDataToAtomOperation(data, target);
				if (op)
					opers.push(op);
			}
		}
		var operation;
		if (opers.length > 1)
			operation = new Kekule.MacroOperation(opers);
		else
			operation = opers[0];

		if (operation)  // only execute when there is real modification
		{
			var editor = this.getEditor();
			editor.execOperation(operation);
		}
	},

	/** @private */
	_createNewDataToAtomOperation: function(newData, atom)
	{
		if (!newData)
			return;
		//console.log('apply setter', newData);

		var nodeClass = newData.nodeClass;
		var modifiedProps = newData.props;
		var repItem = newData.repositoryItem;
		var newNode;

		if (repItem)  // need to apply structure repository item
		{
			var repResult = repItem.createObjects(atom) || {};
			var repObjects = repResult.objects;
			var transformParams = Kekule.Editor.RepositoryStructureUtils.calcRepObjInitialTransformParams(this.getEditor(), repItem, repResult, atom, null);
			this.getEditor().transformCoordAndSizeOfObjects(repObjects, transformParams);
			newNode = repObjects[0];
			nodeClass = newNode.getClass();
		}

		if (newData.isUnknownPseudoatom && !this.getEditorConfigs().getInteractionConfigs().getAllowUnknownAtomSymbol())
			nodeClass = null;

		if (!nodeClass)
		{
			Kekule.error(Kekule.$L('ErrorMsg.INVALID_ATOM_SYMBOL'));
			return null;
		}
		else
		{
			return this._createModificationOperation(atom, newNode, nodeClass, modifiedProps);
		}
	},
	/**
	 * @private
	 */
	_createModificationOperation: function(node, newNode, newNodeClass, modifiedProps)
	{
		var newNode;
		var operGroup, oper;
		var oldNodeClass = node.getClass();
		if (newNode && !newNodeClass)
			newNodeClass = newNode.getClass();
		if (newNode || newNodeClass !== oldNodeClass)  // need to replace node
		{
			operGroup = new Kekule.MacroOperation();
			if (!newNode)
				newNode = new newNodeClass();
			var tempNode = new Kekule.ChemStructureNode();
			tempNode.assign(node);
			newNode.assign(tempNode);  // copy some basic info of old node
			var operReplace = new Kekule.ChemStructOperation.ReplaceNode(node, newNode, null, this.getEditor());
			operGroup.add(operReplace);
		}
		else  // no need to replace
			newNode = node;

		if (modifiedProps)
		{
			oper = new Kekule.ChemObjOperation.Modify(newNode, modifiedProps);
			if (operGroup)
				operGroup.add(oper);
		}

		var operation = operGroup || oper;
		return operation;
	}
});

/**
 * A modifier to change the bond property of chem connectors.
 * @class
 * @augments Kekule.Editor.ObjModifier.Base
 */
Kekule.Editor.ObjModifier.Bond = Class.create(Kekule.Editor.ObjModifier.Base,
/** @lends Kekule.Editor.ObjModifier.Bond# */
{
	/** @private */
	CLASS_NAME: 'Kekule.Editor.ObjModifier.Bond',
	/** @construct */
	initialize: function($super, editor)
	{
		$super(editor);
		this._activeSelBtnHtmlClass = null;
		this._defaultBondTypeData = null;
	},
	/** @private */
	initProperties: function()
	{
		// private
		this.defineProp('bondSelector', {
			'dataType': 'Kekule.Widget.BaseWidget', 'serializable': false, 'setter': null
		});
	},
	/** @ignore */
	doCreateWidget: function()
	{
		var result = new Kekule.Widget.DropDownButton(this.getEditor());
		result.setHint(Kekule.$L('ChemWidgetTexts.HINT_BOND_MODIFIER'));
		result.setText(Kekule.$L('ChemWidgetTexts.CAPTION_BOND_MODIFIER'));
		result.setShowText(false);
		result.setButtonKind(Kekule.Widget.Button.Kinds.DROPDOWN);
		result.addClassName(CCNS.COMPOSER_BOND_MODIFIER_BUTTON);

		var bondSelector = this._createBondSelector(this.getEditor());
		this.setPropStoreFieldValue('bondSelector', bondSelector);

		result.setDropDownWidget(bondSelector);

		if (this._defaultBondTypeData.htmlClass)
			result.addClassName(this._defaultBondTypeData.htmlClass);  // initialize default bond html class name, for button icon

		return result;
	},

	/** @private */
	_filterBond: function(targets)
	{
		var result = [];
		for (var i = 0, l = targets.length; i < l; ++i)
		{
			var target = targets[i];
			if (target instanceof Kekule.Bond)
			{
				result.push(target);
			}
		}
		return result;
	},
	/** @private */
	_getActualModificationBonds: function(targets, byPassfilter)
	{
		var result = [];
		for (var i = 0, l = targets.length; i < l; ++i)
		{
			var target = targets[i];
			if (target instanceof Kekule.StructureFragment && target.isExpanded())  // actually modify children bond in expanded group
			{
				var children = this._getActualModificationBonds(target.getNodes(), true);  // cascade child expanded groups
				AU.pushUnique(result, children);
				AU.pushUnique(result, target.getConnectors())
			}
			else if (target instanceof Kekule.Bond)
				result.push(target);
		}
		if (!byPassfilter)
			result = this._filterBond(result);
		return result;
	},

	/** @private */
	_createBondSelector: function(parentWidget)
	{
		var result = new Kekule.ChemWidget.StructureConnectorSelectPanel(parentWidget);
		result.addClassName(CCNS.COMPOSER_BOND_MODIFIER_DROPDOWN);
		if (this.getEditor().getEnabledBondFormData)
		{
			var bondTypeData = this.getEditor().getEnabledBondFormData();
			result.setBondData(bondTypeData);
			this._defaultBondTypeData = bondTypeData[0];  // regard the first one as default
		}

		// react to value change of setter
		var self = this;
		result.addEventListener('valueChange', function(e){
			self.applyToTargets();
			result.dismiss();
		});

		return result;
	},

	/** @private */
	_setActiveBondHtmlClass: function(className)
	{
		var oldClassName = this._activeSelBtnHtmlClass;
		if (oldClassName)
			this.getWidget().removeClassName(oldClassName);
		this._activeSelBtnHtmlClass = className;
		if (!className)
			className = this._defaultBondTypeData.htmlClass;
		if (className)
			this.getWidget().addClassName(className);
	},
	/** @private */
	_extractBondPropValues: function(bond, propNames)
	{
		if (!propNames)
			propNames = this.getBondSelector().getBondPropNames();
		//console.log('get prop names', propNames, bond.getPropValues(propNames));
		return bond.getPropValues(propNames);
	},

	/** @ignore */
	doLoadFromTargets: function(editor, targets)
	{
		// filter chem connectors from targets
		/*
		var connectors = [];
		for (var i = 0, l = targets.length; i < l; ++i)
		{
			var target = targets[i];
			if (target instanceof Kekule.ChemStructureConnector)
				connectors.push(target);
		}
		*/
		var connectors = this._getActualModificationBonds(targets);

		var comparedPropNames = this.getBondSelector().getBondPropNames();
		var bondPropValues, currPropValues;
		for (var i = 0, l = connectors.length; i < l; ++i)
		{
			currPropValues = this._extractBondPropValues(connectors[i]);
			if (!bondPropValues)
				bondPropValues = currPropValues;
			else if (!Kekule.Editor.StructureUtils.isBondPropsMatch(bondPropValues, currPropValues, comparedPropNames))
			{
				bondPropValues = null;
				break;
			}
		}
		//console.log('set value', bondPropValues);
		this.getBondSelector().setActiveBondPropValues(bondPropValues);
		// copy html class
		this._setActiveBondHtmlClass(this.getBondSelector().getActiveBondHtmlClass());
	},
	/** @ignore */
	doApplyToTargets: function($super, editor, targets)
	{
		var data = this.getBondSelector().getActiveBondPropValues();
		//console.log('modify data', data);
		var opers = [];
		/*
		for (var i = 0, l = targets.length; i < l; ++i)
		{
			var target = targets[i];
			if (target instanceof Kekule.ChemStructureConnector)
			{
				var op = this._createBondModificationOperation(data, target);
				if (op)
					opers.push(op);
			}
		}
		*/
		var bonds = this._getActualModificationBonds(targets);
		for (var i = 0, l = bonds.length; i < l; ++i)
		{
			var bond = bonds[i];
			var op = this._createBondModificationOperation(data, bond);
			if (op)
				opers.push(op);
		}
		var operation;
		if (opers.length > 1)
			operation = new Kekule.MacroOperation(opers);
		else
			operation = opers[0];

		if (operation)  // only execute when there is real modification
		{
			var editor = this.getEditor();
			editor.execOperation(operation);
		}
		//console.log('set class name', this.getBondSelector().getActiveBondHtmlClass());
		this._setActiveBondHtmlClass(this.getBondSelector().getActiveBondHtmlClass());
	},
	/** @private */
	_createBondModificationOperation: function(data, bond)
	{
		var op = new Kekule.ChemObjOperation.Modify(bond, data);
		return op;
	}
});

var OMM = Kekule.Editor.ObjModifierManager;
OMM.register(Kekule.ChemStructureNode, [Kekule.Editor.ObjModifier.Atom]);
OMM.register([Kekule.Bond, Kekule.StructureFragment], [Kekule.Editor.ObjModifier.Bond]); // can change child bonds of structure fragment

})();