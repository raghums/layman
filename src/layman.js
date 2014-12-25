/*
 * layman
 * https://github.com/raghums/layman
 *
 * Copyright (c) 2012 Raghuram Sreenath
 * Licensed under the MIT, GPL licenses.
 */

(function($) {

  // Collection method.
  $.fn.layman = function (callback, config) {
      var f_passedOrBlank = (config && config.frame) ? config.frame : {};
      delete f_passedOrBlank.height;
      delete f_passedOrBlank.width;
      var f = $.extend({
                           border: 3,
                           rows: 72,
                           cols: 36,
                           dim: 25,
                           height: function () {return ((this.rows * this.dim) + ((this.rows - 1) * this.border));},
                           width: function () {return ((this.cols * this.dim) +((this.cols -1) * this.border));}
                       }, f_passedOrBlank);
      var g = (config && config.grid) ? new $.layman.GridModel(config.grid.rowSizes.slice(0), config.grid.cellColSizes.slice(0)) : new $.layman.GridModel([6,6], [18, 18, 18, 18]);
      var ns = this.ns = $.layman.ns, configuration = $.extend({
                                                                          initialColSize: 6,
                                                                          suppressAlerts: false
                                                                      }, config || {});
      $(this).each(function (idx, element) {                          
                       var gridId = ns + Math.floor(Math.random() * 1000000);
                       if ($(this).attr('id')) {
                           gridId = $(this).attr('id');
                       } else {
                           $(this).attr('id', gridId);                              
                       }
                       var grid = new $.layman.Grid(f, g, gridId, callback, configuration);
                       $.layman.drawFrame.call(this, grid, configuration.showButtons);
                       $(this).data('layman', grid.init());
                   });
  };

  // Static method.
  $.layman = function (Grid) {
      return {
          grid:  Grid, lst: [Grid.model], currPtr: 0, prevPtr: -1, buffLen: 1, redoBuff: [], maxLen: 50, ns: $.layman.ns,
          toString: function () {
              return "currPtr: " + this.currPtr + "; prevPtr: " + this.prevPtr + "; buffLen: " + this.buffLen + "; maxLen: " + this.maxLen;
          },
          undo: function (saveParam) {
              if (this.buffLen > 1) {
                  var prevPrevPtr = this.prevPtr - 1;
                  if (prevPrevPtr < 0) {
                      prevPrevPtr = (this.maxLen - 1);
                  }
                  this.redoBuff.push(this.getCurrentGridModel().clone());
                  this.currPtr = this.prevPtr;
                  this.prevPtr = prevPrevPtr;
                  this.setCurrentGridModel();
                  this.grid.redraw();
                  this.buffLen--;
                  if (typeof saveParam == 'undefined') {
                      saveParam = true;
                  }
                  this.save(saveParam);
              } else {
                  if (!this.grid.config.suppressAlerts)
                      alert("[LayoutMananger] Nothing to undo");
              }
          },

          redo: function (saveParam) {
              var g;
              if ((g = this.redoBuff.pop())) {
                  this.checkpoint();
                  this.setCurrentGridModel(g);
                  this.grid.redraw();
                  if (typeof saveParam == 'undefined') {
                      saveParam = true;
                  }
                  this.grid.save(saveParam);
              } else {
                  if (!this.grid.config.suppressAlerts)
                      alert("[LayoutManager] Nothing to redo");
              }
          },

          checkpoint: function () {
              var nextPtr = this.currPtr + 1;
              if (nextPtr > (this.maxLen - 1)) {
                  nextPtr = 0;
              }
              this.buffLen++;
              var clonedObj = this.getCurrentGridModel().clone();
              this.lst[nextPtr] = clonedObj;
              this.prevPtr = this.currPtr;
              this.currPtr = nextPtr;
              this.setCurrentGridModel();
              return this.getCurrentGridModel();
          },

          getCurrentGridModel: function () {
              return this.lst[this.currPtr];
          },

          setCurrentGridModel: function (g) {
              if (g) {
                  this.lst[this.currPtr] = g;
              }
              this.grid.model = this.getCurrentGridModel();
              return this.getCurrentGridModel();;
          },

          // Assumption: Model is already changed to reflect the right number of rows and cols
          // (The sizes are determined by this function using visual structure)
          commit: function (noCheckpoint) {
              if ((typeof noCheckpoint == 'undefined') || !noCheckpoint)
                  this.checkpoint();
              var g = this.getCurrentGridModel();
              var colsCopy = [];
              var rowsCopy = [];
              var cellNum = 1;
              for (var i = 0; i < g.rowSizes.length; i++) {
                  var rowNum = i + 1,
                  rid = this.grid.selector + ' .' + this.ns + 'row-ender-' + rowNum,
                  prevTop = (rowNum == 1) ? 0 : $.layman.getTop(this.grid.selector + ' .' + this.ns + 'row-ender-' + (rowNum - 1)),
                  height = $.layman.getTop(rid) - prevTop,
                  rowSize = Math.ceil(height / (this.grid.frame.dim + this.grid.frame.border));
                  rowsCopy.push(rowSize);
                  var s = 0;
                  for (var j = 0; s < this.grid.frame.cols; j++) {
                      var id = this.grid.selector + " ." + this.ns + "cell-ender-" + cellNum,
                      nCols = $.layman.getNColsForRow(g, this.grid.frame, rowNum);
                      var prevLeft = (j == 0) ? 0 : $.layman.getLeft(this.grid.selector + ' .' + this.ns + 'cell-ender-' + (cellNum - 1)),
                      prevThickness = (prevLeft == 0) ? 0 : this.grid.frame.border,
                      currLeft = ((j + 1) == nCols) ? ((this.grid.frame.cols * this.grid.frame.dim) + ((this.grid.frame.cols - 1) * this.grid.frame.border)) : $.layman.getLeft(this.grid.selector + ' .' + this.ns + 'cell-ender-' + cellNum),
                      width = currLeft - prevLeft - prevThickness,
                      colSize = Math.ceil(width / (this.grid.frame.dim + this.grid.frame.border));
                      colsCopy.push(colSize);
                      s += colSize;
                      cellNum++;
                  }
              }
              g.rowSizes = rowsCopy;
              g.cellColSizes = colsCopy;
              this.grid.save();
          },

          addColumn: function () {
              var g = this.checkpoint();
              var columnCounter = 1, splittables = [], copy = [];
              for (var i = 0; i < g.cellColSizes.length; i++) {
                  var colSize = g.cellColSizes[i];
                  var row = $.layman.getRowNumFromCellIndex(g, this.grid.frame, i+1);
                  var nCols = $.layman.getNColsForRow(g, this.grid.frame, row);
                  if (columnCounter == nCols) { // check for last column of every row to do your magic
                      var splitCandidate = (colSize > this.grid.config.initialColSize) ? i+1 : splittables.pop() ;
                      var indexesInRow = $.layman.getCellIndexesForRow(g, this.grid.frame, row);
                      for (var j = 0; j < indexesInRow.length; j++) {
                          var idx = indexesInRow[j];
                          if (splitCandidate && (idx == splitCandidate)) {
                              copy.push(g.cellColSizes[idx-1] - this.grid.config.initialColSize);
                              copy.push(this.grid.config.initialColSize);
                          } else {
                              copy.push(g.cellColSizes[idx-1]);
                          }
                      }
                      columnCounter = 1;
                      splittables = [];
                  } else {
                      if (colSize > this.grid.config.initialColSize) {
                          splittables.push(i+1);
                      }
                      columnCounter++;
                  }
              }
              g.cellColSizes = copy;
              this.grid.redraw();
              this.grid.save();
              return true;
          },

          addRow: function (rowHt, doSave) {
              if (!rowHt) {
                  rowHt = 3;
              }
              var g = this.checkpoint();
              g.rowSizes.push(rowHt);
              g.cellColSizes.push(this.grid.frame.cols);
              this.grid.redraw();
              if (typeof doSave != 'undefined') {
                  this.grid.save(doSave);
              } else {
                  this.grid.save(true);
              }
          },

          colDeletable: function () {
              var g = this.getCurrentGridModel();                 
              if (!this.grid.allowedSize(g.cellColSizes.length - 1)) {
                  alert("Cannot proceed with delete. Not enough cells to lay out charts.");
                  return false;
              }
              return true;
          },

          rowDeletable: function (elem) {
              var g = this.getCurrentGridModel();
              var row = $(elem).data('rowIndex');
              
              var nCols = $.layman.getNColsForRow(g, this.grid.frame, row);
              if (!this.grid.allowedSize(g.cellColSizes.length - nCols)) {
                  alert("Cannot proceed with delete. Not enough cells to lay out charts.");
                  return false;
              } else if ((row == 1) && (g.rowSizes.length == 1)) {
                  return false; // Atleast 1 row should be there.
              }
              
              return true;
          },

          // assumption: called by click of a row-ender. If called for the last
          // cell of a row, this call will fail
          deleteColumn: function (elem) {
              if (!this.colDeletable()) return;
              var g = this.checkpoint();
              var cellIndex = $(elem).data('cellIndex');
              var leftPart = g.cellColSizes.slice(0, (cellIndex - 1));
              var middle = [g.cellColSizes[cellIndex - 1] + g.cellColSizes[cellIndex]];
              var rightPart = g.cellColSizes.slice(cellIndex + 1);
              g.cellColSizes = leftPart.concat(middle).concat(rightPart);
              this.grid.redraw();
              this.grid.save();
          },

          deleteRow: function (elem) {
              if (!this.rowDeletable(elem)) return;
              var g = this.checkpoint();
              var row = $(elem).data('rowIndex');
              var cellsToRemove = $.layman.getCellIndexesForRow(g, this.grid.frame, row);
              var colsCopy = [];
              for (var i = 0; i < g.cellColSizes.length; i++) {
                  var contains = false;
                  for (var j = 0, L = cellsToRemove.length; j < L; j++) {
                      if (cellsToRemove[j] === (i+1)) 
                          contains = true;
                  }
                  if (!contains) {
                      colsCopy.push(g.cellColSizes[i]);
                  }
              }
              g.cellColSizes = colsCopy;
              var rowLeft = g.rowSizes.slice(0, row-1);
              var rowRight = g.rowSizes.slice(row);
              g.rowSizes = rowLeft.concat(rowRight);
              this.grid.redraw();
              this.grid.save();
          },

          save: function (saveParam) {
              this.grid.save(saveParam);
          }
      };
  };

  $.layman.ns = 'lm-';;

  $.layman.Grid = function (frame, model, gridId, callback, config) {
      return {
          config: config,
          frame: frame,
          model: model,
          ns: $.layman.ns,
          callback: callback,
          gridId: $.layman.ns + gridId,
          selector: '#' + gridId + ' .' + $.layman.ns + 'grid',

          redraw: function () {
              $(this.selector + ' .' + this.ns + 'resisable-horizontal').add(this.selector + ' .' + this.ns + 'resisable-vertical').remove();
              this.draw();
          },

          draw: function () {
              var model = this.model;
              var nRows = model.rowSizes.length;
              var cellNum = 1;
              var htSoFar = 0;
              var prevTop = 0, top = 0, prevLeft = 0, left = 0, currentHeight = 0;
              for (var i  =  0; i < nRows; i++) {
                  var rowSize = model.rowSizes[i];
                  prevTop = top;
                  var prevLineThickness = (i > 0) ? this.frame.border : 0;
                  currentHeight = prevLineThickness + (rowSize * this.frame.dim) + ((rowSize -1) * this.frame.border);
                  top = prevTop + currentHeight;
                  $("<div></div>")
                      .addClass(this.ns + "resisable-horizontal")
                      .addClass(this.ns + 'row-ender-' + (i + 1))
                      .attr('id', this.gridId + '_row-ender-' + (i + 1))
                      .data('rowIndex', (i + 1))
                      .css({top: top, left: 0})
                      .appendTo(this.selector);
                  prevLeft = 0;
                  left = 0;
                  var s = 0;
                  for (var j = 0; s < this.frame.cols; j++) {
                      var colSize = model.cellColSizes[cellNum-1];
                      prevLeft = left;
                      var prevSeperatorThickness = (j > 0) ? this.frame.border : 0;
                      left = prevSeperatorThickness + prevLeft + (this.frame.dim * colSize) + (this.frame.border * (colSize - 1));
                      s += colSize;
                      if (s < this.frame.cols) { // skip writing the last vertical bar
                          $("<div></div>")
                              .addClass(this.ns + "resisable-vertical")
                              .addClass(this.ns + "cell-ender-" + cellNum)
                              .attr('id', this.gridId + '_cell-ender-' + cellNum)
                              .data('cellIndex', cellNum)
                              .css({top: prevTop, left: left, height: currentHeight})
                              .appendTo(this.selector);
                      }
                      cellNum++;
                  }
              }
     
              var Grid = this;
              $(this.selector + ' .' + this.ns + 'resisable-vertical').draggable({
                                                                      snap: this.selector + ' .' + this.ns + 'vertical',
                                                                      axis: "x",
                                                                      stop: function (event, ui) {                                                                                                       
                                                                          if ($.layman.verticalSnappable(Grid, ui.helper, ui.position.left)) {
                                                                              Grid.manager.commit();
                                                                          }
                                                                          Grid.redraw(); // this will bring back the bar to original position if not committed
                                                                      }
                                                                  });

              $(this.selector + ' .' + this.ns + 'resisable-vertical').dblclick(function (event) {
                                                                     Grid.manager.deleteColumn(this);
                                                                 });

              $(this.selector + ' .' + this.ns + 'resisable-horizontal').draggable({
                                                                        snap: this.selector + ' .' + this.ns + 'horizontal',
                                                                        axis: 'y',
                                                                        stop: function (event, ui) {
                                                                            if ($.layman.horizontalSnappable(Grid, ui.helper, Math.ceil(ui.position.top))) { // top is represented as a float in FF, hence the ceil
                                                                                Grid.manager.commit();
                                                                            }
                                                                            Grid.redraw();
                                                                        }
                                                                    });

              $(this.selector + ' .' + this.ns + 'resisable-horizontal').dblclick(function (event) {
                                                                       Grid.manager.deleteRow(this);
                                                                   });
          },

          save: function () {
              if (this.callback) {
                  this.callback.call(this, $.extend({grid:this.model}, {frame:this.frame}), arguments[0]);
              }
          },

          allowedSize: function (size) {
              if ((typeof this.config.minCells == 'undefined') && (typeof this.config.getMinCells == 'undefined')) {
                  return true;
              } else {
                  if (typeof this.config.minCells == 'number') {
                      return (size >= this.config.minCells);
                  } else if (typeof this.config.getMinCells == 'function') {
                      return (size >= this.config.getMinCells());
                  } else {
                      return true;
                  }
              }
          },

          init: function () {
              this.manager = new $.layman(this);
              this.draw();
              return this.manager;
          }
      };
  };

  $.layman.GridModel = function (rowSizes, cellColSizes) {
      return {
          rowSizes: rowSizes,
          cellColSizes: cellColSizes,
          clone: function () {
              return $.extend(true, {}, this);
          }
      };
  };

  $.layman.getRowNumFromCellIndex = function (g, frame, idx) {
      var rNum = 0, s = 0;
      for (var i = 0; i < idx; i++) {
          if (s == 0) rNum++;
          s += g.cellColSizes[i];
          if (s == frame.cols) {
              s = 0;
          }
      }
      return rNum;
  };

  $.layman.getColNumFromCellIndex = function (g, frame, idx) {
      var cNum = 0, s = 0;
      for (var i = 0; i < idx; i++) {
          cNum = (s == 0) ? 1 : cNum+1;
          s += g.cellColSizes[i];
          if (s == frame.cols) {
              s = 0;
          }
      }
      return cNum;
  };

  $.layman.getNColsForRow = function (g, frame, row) {
      for (var i = 0; i < g.cellColSizes.length; i++) {
          var currRow = $.layman.getRowNumFromCellIndex(g, frame, i+1);
          if (currRow == row) {
              var nCols = 0, j = i;
              while ($.layman.getRowNumFromCellIndex(g, frame, j+1) == row) {
                  nCols++;
                  j++;
              }
              return nCols;
          }
      }
      return -1;           
  };

  $.layman.getCellIndexesForRow = function (g, frame, row) {
      var indexes = [];
      for (var i = 0; i < g.cellColSizes.length; i++) {
          if ($.layman.getRowNumFromCellIndex(g, frame, i+1) == row) {
              indexes.push(i+1);
          }
      }
      return indexes;
  };

  $.layman.numFromPx = function (px) {
      return +(px.substring(0, px.indexOf('px')));
  };

  $.layman.getLeft = function (id) {
      var selector  = (id[0] === "#") ? id : "#" + id;
      var left = $(selector).css('left');
      return $.layman.numFromPx(left);
  };

  $.layman.getTop = function (id) {
      var selector  = (id[0] === "#") ? id : "#" + id;
      var left = $(selector).css('top');
      return $.layman.numFromPx(left);
  };

  $.layman.horizontalSnappable = function (grid, elem, top)  {
      var g = grid.model,
             frame = grid.frame;
      var row = elem.data('rowIndex'),
      nRows = g.rowSizes.length,
      topExtreme = (row == 1) ? 0 : $.layman.getTop(grid.selector + ' .' + this.ns + 'row-ender-' + (row - 1)),
      gridHeight = frame.height(),
      bottomExtreme = (row == nRows) ? gridHeight  : $.layman.getTop(grid.selector + ' .' + this.ns + 'row-ender-' + (row +1));

      if ((top <= topExtreme) || (top >= bottomExtreme)) {
          return false;
      }

      for (var i = 0; i < frame.rows; i++) {
          var possibleTop = (i * frame.border) + ((i + 1) * frame.dim);
          if (top == possibleTop) {
              return true;
          }
      }
      return false;
  };

  $.layman.verticalSnappable = function (grid, elem, left) {
      var g = grid.model,
             frame = grid.frame;
      var cellIndex = elem.data('cellIndex');
      var row = $.layman.getRowNumFromCellIndex(g, frame, cellIndex);
      var col = $.layman.getColNumFromCellIndex(g, frame, cellIndex);
      var nCols = $.layman.getNColsForRow(g, frame, row);
      if (nCols == 1) {
          // should never come here
          return false;
      }
      var leftExtreme = (col == 1) ? 0 : $.layman.getLeft(grid.selector + " ." + this.ns + "cell-ender-" + (cellIndex - 1));
      var rightExtreme = (col == (nCols - 1)) ? grid.frame.width() : $.layman.getLeft(grid.selector + " ." + this.ns + "cell-ender-" + (cellIndex + 1));
      if ((left <= leftExtreme) || (left >= rightExtreme)) {
          return false;
      }
      for (var i = 0; i < (frame.cols - 1); i++) {
          var possibleLeft = ((i+1) * frame.dim) + (i * frame.border);
          if (left === possibleLeft) {
              return true;
          }
      }
      return false;
  };

  $.layman.drawFrame = function (grid, sb) {
      var showButtons = true;
      if (sb) {
          showButtons = sb;
      }

      if (showButtons) {
          $("<button>undo</button>").attr('id', grid.gridId + '_undo').bind('click', function () {grid.manager.undo();}).appendTo(this);
          $("<button>redo</button>").attr('id', grid.gridId + '_redo').bind('click', function () {grid.manager.redo();}).appendTo(this);
          $("<button>Add Column</button>").attr('id', grid.gridId + '_addcol').bind('click', function () {grid.manager.addColumn();}).appendTo(this);
          $("<button>Add Row</button>").attr('id', grid.gridId + '_addrow').bind('click', function () {grid.manager.addRow();}).appendTo(this);
          $("<button>Save</button>").attr('id', grid.gridId + '_save').bind('click', function () {grid.manager.save();}).appendTo(this);
      }

      var g = $("<div></div>").addClass(grid.ns + 'grid').attr('id', grid.gridId).appendTo(this);
      
      for (var i = 0; i < grid.frame.rows; i++) {             
          var row = $("<div></div>").addClass(grid.ns + 'row').attr('id', grid.gridId + '_row_' + i).appendTo(g);
          for (var j = 0; j < grid.frame.cols; j++) {
              $("<div></div>").addClass(grid.ns + 'cell').attr('id', grid.gridId + '_cell_' + i + '_' + j).data('coords', {x:i,y:j}).appendTo(row);
              if (j < (grid.frame.cols - 1)) {
                  $("<div></div>").addClass(grid.ns + 'vertical').attr('id', grid.gridId + '_vertical_' + i + '_' + j).data('coords', {x:i,y:j}).appendTo(row);
              }
          }
          $("<div></div>").addClass(grid.ns + "row-end").attr('id', grid.gridId + '_row_end_' + i).appendTo(g);

          // Horizontal line should not be written for the final row
          if (i < (grid.frame.rows - 1)) {
              var rowH = $("<div></div>").addClass(grid.ns + 'row').attr('id', grid.gridId + '_rowH_' + i).appendTo(g);
              $("<div></div>").addClass(grid.ns + 'horizontal').attr('id', grid.gridId + '_horizontal_' + i).appendTo(rowH);
              $("<div></div>").addClass(grid.ns + "row-end").attr('id', grid.gridId + '_row-end_' + i).appendTo(g);
          }
      }

      $("<div></div>").addClass('clear').appendTo(this);
  };

}(jQuery));
