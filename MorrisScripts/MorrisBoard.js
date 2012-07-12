
// the singleton instance of the board can be access via self for functions without context
var self;

// construct with the name of the div that will contain the canvas/stage
function MorrisBoard(elementName,w,h) {

    // create a proxy for functions without context

    self = this;

    // create the stage

    this.stage = new Kinetic.Stage({
        container: elementName,
        width: w,
        height: h
    });

    // create the layer for the board and lines connecting squares

    this.backgroundLayer = new Kinetic.Layer();

    // red/green layer is above the board and below the pieces

    this.targetLayer = new Kinetic.Layer();

    // hide this layer by default

    this.targetLayer.hide();

    // layer for pieces

    this.pieceLayer = new Kinetic.Layer();

    // layer for UI hints

    this.hintLayer = new Kinetic.Layer();

    // add layers in their correct Z order

    this.stage.add( this.backgroundLayer );

    this.stage.add( this.targetLayer );

    this.stage.add( this.pieceLayer );

    this.stage.add( this.hintLayer );

    // setup display metrics

    this.UpdateMetrics();

    // do initial paint of board ( the board layer never changes )

    this.PaintBoard();

    // set initial state, no pieces, nothing in hand

    this.Reset();

}

//
// clear board etc ready for a new game
//
MorrisBoard.prototype.Reset = function() {


    for( var i = 0 ; i < this.ROWS * this.COLS ; i++)
        this.pieces[i] = this.EMPTY;

    // initial piece update

    this.UpdatePieces();

    // update stones in hand

    this.UpdateInHandPieces();

    // update UI hints

    this.UpdateUIHints();
}

//
// update with the current board and number of pieces in hand.
//
MorrisBoard.prototype.Update = function( board, inHand ) {

    // copy board array and in-hand total to ourselves

    for( var i = 0 ; i < board.length ; i++ )
        this.pieces[i] = board[i];

    this.whiteHand = inHand.White;

    this.blackHand = inHand.Black;

    // when updating we can remove all hints

    this.ResetUIHints();

    // update display

    this.UpdateInHandPieces();

    this.UpdatePieces();

}

//
// calculate size of squares etc
//
MorrisBoard.prototype.UpdateMetrics = function() {

    // get min dimension to work with

    var min = Math.min( this.stage.getWidth(), this.stage.getHeight() - this.handHeight );

    // square size is the smaller of the two

    this.sqs = Math.floor( min / 7 );

    this.doffset = { x:Math.floor((this.stage.getWidth() - this.sqs * this.COLS)/2),
                     y:this.handHeight + Math.floor( ((this.stage.getHeight() - this.handHeight) - (this.sqs * this.ROWS))/2)};

}

// height of area that shows pieces in hand

MorrisBoard.prototype.handHeight = 80;

// get the bounds of the given square ( x,y,width,height )

MorrisBoard.prototype.GetSquare = function( r,c ) {

    return { x:this.doffset.x + c * this.sqs, y:this.doffset.y + this.sqs * r, width:this.sqs,height:this.sqs };
}

// get the center of the square {x,y}

MorrisBoard.prototype.GetCenter = function(r,c) {

    return { x:Math.floor( this.doffset.x + (c * this.sqs) + (this.sqs/2)),
             y:Math.floor( this.doffset.y + (r * this.sqs) + (this.sqs/2)) };

}

//
// reset all UI hints
//
MorrisBoard.prototype.ResetUIHints = function() {

    for( var i = 0 ; i < this.uiHints.length ; i++ )
        this.uiHints[i] = this.UI_NOTHING;

    this.UpdateUIHints();
}
//
// remove add UI hints as required
//
MorrisBoard.prototype.UpdateUIHints = function() {

    // remove all current glyphs

    this.hintLayer.removeChildren();

    for( var row = 0 ; row < this.ROWS ; row++)
        for( var col = 0 ; col < this.COLS ; col++ ){

            var e = this.GetUIGlyph( this.uiHints[ row * this.COLS + col] );

            if ( e != null )
            {
                var s = this.GetCenter(row,col);

                e.setPosition(s.x, s.y);

                this.hintLayer.add( e );
            }
        }

    this.hintLayer.draw();
}

//
// get a circle node for the given piece color. Center offset is center of circle
//
MorrisBoard.prototype.GetUIGlyph = function( type ) {

    switch ( type )
    {
        case this.UI_CIRCLE: {

            var d = this.sqs-20;
            var r = d / 2;

            return new Kinetic.Circle({
                radius: r,
                stroke: 'rgba(0,255,0,1)',
                strokeWidth: 12
            });
        }

        case this.UI_CROSS: {

            var d = this.sqs-40;

            var r = d / 2;

            var group = new Kinetic.Group({});

            var redLine = new Kinetic.Line({
                points: [-r,-r,r,r],
                stroke: 'rgba(255,0,0,1)',
                strokeWidth: 12,
                lineCap: "round",
                lineJoin: "round"
            });

            group.add( redLine );

            redLine = new Kinetic.Line({
                points: [-r,r,r,-r],
                stroke: 'rgba(255,0,0,1)',
                strokeWidth: 12,
                lineCap: "round",
                lineJoin: "round"
            });

            group.add( redLine );

            return group;
        }
    }

    return null;

}



//
// update the target layer with the current contents of this.validLocations
//
MorrisBoard.prototype.UpdateTargets = function() {

    // reset all targets

    var i,row,col

    for( i = 0 ; i < this.targets.length ; i++)
        this.targets[i] = this.TARGET_NOTHING;

    // insert valid locations if there are any

    if ( this.validLocations != null ) {

        for( var row = 0 ; row < this.ROWS ; row++)
        {
            for( var col = 0 ; col < this.COLS ; col++ )
            {

                var index = row * this.COLS + col;

                if ( this.IsValidSquare( row,col ) == true )
                {
                    this.targets[index] = this.TARGET_GREEN;
                }
                else
                {
                    // make red only if playable and empty

                    if ( this.playable[index] > 0 )
                        this.targets[index] = this.TARGET_RED;
                }
            }
        }
    }

    // remove all current glyphs

    this.targetLayer.removeChildren();

    for( row = 0 ; row < this.ROWS ; row++)
        for( col = 0 ; col < this.COLS ; col++ ){

            var e = this.GetTargetGlyph( this.targets[ row * this.COLS + col] );

            if ( e != null )
            {
                var s = this.GetCenter(row,col);

                e.setPosition(s.x, s.y);

                this.targetLayer.add( e );
            }
        }
}

//
// get a circle node for the given piece color. Center offset is center of circle
//
MorrisBoard.prototype.GetTargetGlyph = function( type ) {

    switch ( type )
    {
        case this.TARGET_GREEN: {

            return new Kinetic.Circle({
                radius: 6,
                fill: 'rgb(0,255,0)',
                strokeWidth : 2,
                stroke : 'white'
            });
        }

        case this.TARGET_RED: {

            return new Kinetic.Circle({
                radius: 6,
                fill: 'rgb(255,0,0)',
                strokeWidth : 2,
                stroke : 'white'
            });
        }
    }

    return null;

}

//
// Remove all existing pieces and update with the current location
//
MorrisBoard.prototype.UpdatePieces = function() {

    // create as required

    if ( this.pieceNodes == null )
        this.pieceNodes = [];

    // remove old glyphs and update with new ones

    var row, col;

    for( row = 0 ; row < this.ROWS ; row++)
    {
        for( col = 0 ; col < this.COLS ; col++ )
        {
            var obj = this.pieceNodes[ row*this.COLS+col ];

            if ( obj != null ) {

                this.pieceLayer.remove( obj.glyph );

                this.pieceNodes[ row*this.COLS+col ] = null;

            }

            var e = this.GetPieceGlyph( this.pieces[row*this.COLS+col]);

            if ( e != null )
            {
                var s = this.GetCenter(row,col);

                e.setPosition(s.x, s.y);

                this.pieceLayer.add( e );

                this.pieceNodes[ row*this.COLS+col ] = { glyph:e, row:row, column:col };
            }
        }
    }

    this.pieceLayer.draw();

/*
    var s = "Pieces:\n";

    var sn = "Nodes:\n"

    for( row = 0 ; row < this.ROWS ; row++) {

        s += "\n";

        sn += "\n";

        for( col = 0 ; col < this.COLS ; col++ ){

            var i = row * this.COLS + col;

            if ( this.playable[i] == 0 ) {

                s += "[ ]";

                sn += "[ ]";
            }
            else
            {
                var p = this.pieces[i];

                switch ( p ){
                    case 0: s += "[W]"; break;
                    case 1: s += "[B]"; break;
                    case 2: s += "[.]"; break;
                }

                p = this.pieceNodes[i];

                if ( p != null )
                    sn += "[X]";
                else
                    sn += "[.]";
            }
        }
    }

    console.log( s );

    console.log( sn );
*/
}

//
// get a circle node for the given piece color. Center offset is center of circle
//
MorrisBoard.prototype.GetPieceGlyph = function( color ) {

    if ( color == this.EMPTY )
        return null;

    var d = this.sqs-12;

    var r = d / 2;

    if ( color == this.WHITE )
    {
        return new Kinetic.Circle({
            radius: r,
            fill: {
                start: {
                    x: -r,
                    y: -r
                },
                end: {
                    x: r,
                    y: r
                },
                colorStops: [0, '#FFFFFF', 1, '#A5A5A5'],
                rotation:45
            },

            stroke: "black",
            strokeWidth: 2,
            draggable:false,
            shadow: {
                color: 'black',
                blur: 2,
                offset: [3,3],
                alpha: 0.6
            }
        });
    }
    else
    {
        var g = new Kinetic.Group({
            draggable:false
        });

        var c = new Kinetic.Circle({
            radius: r+1,
            fill: {
                start: {
                    x: -r,
                    y: -r
                },
                end: {
                    x: r,
                    y: r
                },
                colorStops: [0, '#FFFFFF', 1, '#A5A5A5'],
                rotation:45
            },
            shadow: {
                color: 'black',
                blur: 2,
                offset: [3,3],
                alpha: 0.6
            }
        });

        g.add(c);

        c = new Kinetic.Circle({
            radius: r-1,
            fill: 'black',
            draggable:false
        });

        g.add(c);

        return g;
    }
}


//
// update in-hand pieces for both sides
//
MorrisBoard.prototype.UpdateInHandPieces = function() {

    // divide area into two halves

    var half = this.stage.getWidth()/2;


    //var whiteArea = { x:4,y:0,width:half-8,height:this.handHeight };

    //var blackArea = { x:half+4,y:0,width:half-8,height:this.handHeight };

    var whiteArea = {   x:this.doffset.x,
                        y:0,
                        width:(this.sqs * this.COLS)/2,
                        height:this.handHeight };

    var blackArea = {   x:this.doffset.x + (this.sqs * this.COLS)/2,
                        y:0,
                        width:(this.sqs * this.COLS)/2,
                        height:this.handHeight };

    // remove all old nodes

    var n;

    while ( this.whiteHandNodes.length > 0 )
    {
        n = this.whiteHandNodes.pop();

        this.pieceLayer.remove(n);
    }

    // add any necessary pieces

    while ( this.whiteHandNodes.length < this.whiteHand )
    {
        n = this.GetPieceGlyph(this.WHITE);

        this.whiteHandNodes.push(n);

        this.pieceLayer.add(n);
    }

    var spacing = ( whiteArea.width - this.sqs ) / 9;

    var i;

    for( i = 0 ; i < this.whiteHandNodes.length ; i++ ) {

        var c = this.whiteHandNodes[i];

        c.moveToTop();

        c.draggable(false);

        c.setPosition( whiteArea.x + this.sqs / 2 + spacing * i, this.handHeight / 2 );
    }


    // repeat for black pieces in hand
    
    while ( this.blackHandNodes.length > 0 )
    {
        n = this.blackHandNodes.pop();

        this.pieceLayer.remove(n);
    }

    // add any necessary pieces

    while ( this.blackHandNodes.length < this.blackHand )
    {
        n = this.GetPieceGlyph(this.BLACK);

        this.blackHandNodes.push(n);

        this.pieceLayer.add(n);
    }

    spacing = ( blackArea.width - this.sqs ) / 9;

    for( i = 0 ; i < this.blackHandNodes.length ; i++ ) {

        var c = this.blackHandNodes[i];

        c.moveToTop();

        c.draggable(false);

        c.setPosition( blackArea.x + this.sqs / 2 + spacing * i, this.handHeight / 2  );
    }


    // update layer

    this.pieceLayer.draw();
}


// pieces currently displayed as in-hand for each side ( arrays )

MorrisBoard.prototype.whiteHandNodes = [];

MorrisBoard.prototype.blackHandNodes = [];

//
// paint the board background layer
//
MorrisBoard.prototype.PaintBoard = function() {

    // remove existing children from background layer

    this.backgroundLayer.removeChildren();

    // paint background

    var rect = new Kinetic.Rect({
                                    x: this.doffset.x,
                                    y: this.doffset.y,
                                    width: this.sqs * this.COLS,
                                    height: this.sqs * this.ROWS,
                                    fill: "#C9F9FF",
                                    stroke: "#257993",
                                    strokeWidth: 1
    });

    // add the shape to the layer

    this.backgroundLayer.add(rect);

    // paint all lines connecting valid locations using the thicker/darker line

    this.PaintLines( "#257993", 8 );

    // painter intersections thick and dark

    this.PaintIntersections( "#257993", 12 );

    // now repeat with thinner / lighter graphics

    this.PaintLines( "#FFFFFF", 1 );

    // painter intersections thick and dark

    this.PaintIntersections( "#FFFFFF", 6 );

    // redraw layer

    this.backgroundLayer.draw();
}

//
// paint lines connecting valid locations
//
MorrisBoard.prototype.PaintLines = function( color, thickness ) {

    for( var i = 0 ; i < this.lines.length ; i+= 2){

        // get starting and ending square of line

        var start = this.GetCenter(this.lines[i].row,this.lines[i].col);

        var end = this.GetCenter(this.lines[i+1].row,this.lines[i+1].col);

        // add horizontal line

        var line = new Kinetic.Line({   points: [ start.x, start.y, end.x, end.y],
                                        stroke: color,
                                        strokeWidth: thickness,
                                        lineCap: "square",
                                        lineJoin: "square"
                                    });

        this.backgroundLayer.add( line );


        // add vertical line

        start = this.GetCenter(this.lines[i].col,this.lines[i].row);

        end = this.GetCenter(this.lines[i+1].col,this.lines[i+1].row);

        line = new Kinetic.Line({   points: [ start.x, start.y, end.x, end.y],
                                    stroke: color,
                                    strokeWidth: thickness,
                                    lineCap: "square",
                                    lineJoin: "square"
                                });

        this.backgroundLayer.add( line );

    }
}
//
// paint intersections of lines
//
MorrisBoard.prototype.PaintIntersections = function( color, radius ) {

    // paint intersection of lines which correspond to the legal squares

    for( var row = 0 ; row < this.ROWS ; row++)
        for( var col = 0 ; col < this.COLS ; col++ ) {

            if ( this.playable[ row * this.COLS + col ] > 0 )
            {
                var s = this.GetCenter( row,col );

                var e =  new Kinetic.Circle({   x:s.x,
                                                y:s.y,
                                                radius: radius,
                                                fill: color
                                            });

                this.backgroundLayer.add( e );

                // show square location
/*
                var r = this.GetSquare( row,col );

                var t = new Kinetic.Text({
                                            x:r.x,
                                            y:r.y,
                                            text:row.toString() + col.toString(),
                                            fontSize: 10,
                                            fontFamily: "Arial",
                                            textFill: "black",
                                            align: "left",
                                            verticalAlign: "top"
                                        });

                this.backgroundLayer.add(t);
*/
            }

        }
}

//
// show a move that is described by the parameter. Format:
// .MoveType = [ "Insert", "SlideOrFly" ]
// .FromSquare = { row:xxx, column:xxx } OR undefined if an insert
// .ToSquare = { row:xxx, column:xxx } always present
// .IsCapture = true | false;
// .CaptureSquare = if .IsCapture == true then = { row:xxx, column:xxx }
// .White = true or false. True if the move was played by white, otherwise false
//
MorrisBoard.prototype.ShowMove = function( descriptor, b, h ) {

    // save as this.showMove

    this.showingMove = descriptor;

    // save board and hand to update to after showing

    this.showBoard = b;

    this.showHand = h;

    var node, c;

    // if an insert slide a piece from the correct pile of pieces

    if ( descriptor.MoveType == "Insert") {

        // get top of pile for correct side

        node = descriptor.White ? this.whiteHandNodes.pop() : this.blackHandNodes.pop();

        // get destination square

        c = this.GetCenter( descriptor.ToSquare.row, descriptor.ToSquare.column );

        // top of z order

        node.moveToTop();

        // tween into place

        this.slideNode = node;

        node.transitionTo({
            x:c.x,
            y:c.y,
            duration: 0.5,
            easing: 'ease-in-out',
            callback: this.OnMoveTransitionComplete
        });

        // insert into piece array so that it will be removed next time Update is called

        var index = descriptor.ToSquare.row * this.ROWS + descriptor.ToSquare.column;

        this.pieceNodes[ index ] = { glyph:this.slideNode, row:descriptor.ToSquare.row, column:descriptor.ToSquare.column };
    }
    else
    {
        // slide or fly

        node = this.pieceNodes[ descriptor.FromSquare.row * this.COLS + descriptor.FromSquare.column ].glyph;

        c = this.GetCenter( descriptor.ToSquare.row, descriptor.ToSquare.column );

        node.transitionTo({
            x:c.x,
            y:c.y,
            duration: 0.5,
            easing: 'ease-in-out',
            callback: this.OnMoveTransitionComplete
        });
    }
}

//
// the node being slide into position
//
MorrisBoard.prototype.slideNode;

//
// the move descriptor for the move we are showing
//
MorrisBoard.prototype.showingMove;

//
// board and hand to update to after showing move
//
MorrisBoard.prototype.showBoard;

MorrisBoard.prototype.showHand;


//
// call back at end of insert slide triggered by ShowMove. Context = the node being moved
//
MorrisBoard.prototype.OnMoveTransitionComplete = function() {


    // continue with move

    var move = self.showingMove;

    // if there was a capture then fade that piece out

    if ( move.IsCapture == true ) {

        // get node at capture location

        var node = self.pieceNodes[ move.CaptureSquare.row * self.COLS + move.CaptureSquare.column ].glyph;

        node.transitionTo({ alpha:0, duration: 0.5, easing: 'ease-in-out', callback: self.OnCaptureFadeComplete });
    }
    else
    {
        // we have finished showing the move so we can update to the board and hand setup that was provided with ShowMove

        self.Update( self.showBoard, self.showHand );

        // dispatch event to indicate show move is completed

        self.RaiseEvent( "ShowMoveCompleted" );
    }
}

//
// after fading out the captured piece
//
MorrisBoard.prototype.OnCaptureFadeComplete = function(){

    // we have finished showing the move so we can update to the board and hand setup that was provided with ShowMove

    self.Update( self.showBoard, self.showHand );

    // dispatch event to indicate show move is completed

    self.RaiseEvent( "ShowMoveCompleted" );
}

//
// get a capture from the given possible locations
//
MorrisBoard.prototype.GetCapture = function( side, locations ) {

    // save possible captures

    this.validLocations = locations;

    // highlight the possible capture with a UI hint and make the piece at each location clickable

    for( var i = 0 ; i < locations.length ; i+= 2) {

        var index = locations[i] * this.COLS + locations[i+1];

        this.uiHints[index] = this.UI_CROSS;

        var piece = this.pieceNodes[index].glyph;

        piece.on( "mouseup touchend", this.OnCaptureClicked);
    }

    // redraw all hints

    this.UpdateUIHints();

}

//
// when a capture piece is clicked
//
MorrisBoard.prototype.OnCaptureClicked = function(evt) {

    // this == the Kinetic node here, use self for MorrisBoard instance

    // find the piece that was clicked

    var piece = null;

    for( var i = 0 ; i < self.pieceNodes.length ; i++ )
        if ( self.pieceNodes[i] != null && this == self.pieceNodes[i].glyph ) {

            piece = self.pieceNodes[i];

            break;
        }

    // dispatch event with from/to/capture square row/columns

    self.RaiseEvent( "CaptureCompleted", [

        self.fromSquare == null ? -1 : self.fromSquare.row,
        self.fromSquare == null ? -1 : self.fromSquare.column,
        self.toSquare.row,
        self.toSquare.column,
        piece.row,
        piece.column

    ]);
}

//
// allow the user to play an insert for the given color using the given array or row/column
// locations. Fire the InsertComplete event when the accomplish
//
MorrisBoard.prototype.GetInsert = function( side, locations )
{
    // save locations for when the user starts the drag operation

    this.validLocations = locations;

    // update target layer with valid locations

    this.UpdateTargets();

    // save drag side

    this.dragSide = side;

    // make the top most piece of the 'in-hand' pieces draggable for the given side

    var nodes = side == this.WHITE ? this.whiteHandNodes : this.blackHandNodes;

    var piece = nodes[ nodes.length - 1];

    piece.draggable(true);

    // sink begin drag / end drag events on piece

    piece.on("dragstart", this.OnStartDragInsert );

    piece.on("dragend", this.OnEndDragInsert );

    // bring to top so it will go in front of all other pieces

    piece.moveToTop();

    // save piece being dragged and origin of drag

    this.dragPiece = piece;

    this.startDragLocation = { x:piece.getX(), y:piece.getY() }
}

//
// allow the user to start a slide or a fly for the given side from the given locations
//
MorrisBoard.prototype.GetMoveStart = function( side, locations )
{
    // save locations for when the user starts the drag operation

    this.validLocations = locations;

    // save drag side

    this.dragSide = side;

    // create list of moveable nodes

    this.moveable = [];

    // make the pieces at the given locations draggable

    for( var i = 0 ; i < locations.length ; i+= 2) {

        var index = locations[i] * this.COLS + locations[i+1];

        var piece = this.pieceNodes[index].glyph;

        // make draggable and sink drag start event

        piece.draggable(true);

        piece.on("dragstart", this.OnStartDragSlideOrFly );

        piece.on("dragend", this.OnEndSlideOrFly);

        this.moveable.push(piece);
    }

}

//
// used to hold the pieces that are movable for a slide or fly
//
MorrisBoard.prototype.moveable = [];

//
// start drag / drop of piece while waiting for a slide or fly to start
//
MorrisBoard.prototype.OnStartDragSlideOrFly = function(glyph) {

    // 'this' is the Kinetic node that was dragged, self is the MorrisBoard instance:

    // find the glyph in the pieceNodes array. Then we will know the row/column

    for( var i = 0 ; i < self.pieceNodes.length ; i++ ){

        var obj = self.pieceNodes[i];

        if ( obj != null && obj.glyph == this) {

            self.fromSquare = obj;

            self.RaiseEvent( "SlideOrFlyStarted", [ obj.row, obj.column ] )
        }
    }

    // bring node to top of z order

    this.moveToTop();

    // enlarge and increase size/shadow and make transparent

    this.setAttrs({
        shadow: {
            offset: {
                x: 6,
                y: 6
            }
        },
        scale: {
            x: 1.1,
            y: 1.1
        },
        alpha: 0.5
    });

}

// during a slide or fly this is the piece being moves ( .glyph .row .column ) once a piece is selected

MorrisBoard.prototype.fromSquare;

// during a slide, fly OR insert, this is the destination square

MorrisBoard.prototype.toSquare;

// during a slide, fly or insert this is the location of the capture

MorrisBoard.prototype.captureSquare;

//
// after starting a slide or fly we expect to be given the valid locations via this method
//
MorrisBoard.prototype.SetDestinations = function( side, locations ) {

    // save locations for when the user starts the drag operation

    this.validLocations = locations;

    this.UpdateTargets();

    this.targetLayer.show();

    this.targetLayer.draw();

    // save drag side

    this.dragSide = side;

}

//
// after dropping a slide or fly move
//
MorrisBoard.prototype.OnEndSlideOrFly = function(evt) {

    // hide targets

    self.targetLayer.hide();

    self.targetLayer.draw();

    // determine where piece was dropped

    var s = self.GetSquareAt(evt);

    // if it was on the board AND it is in the validLocations array then process the move
    // otherwise, return the piece to the hand pile

    if ( s != null && self.IsValidSquare(s.row, s.column ) ) {

        // make all movable pieces unmovable

        for( var m = 0 ; m < self.moveable.length ; m++ ) {

            self.moveable[m].draggable(false);

            self.moveable[m].off("dragstart");

            self.moveable[m].off("dragend");
        }

        // position on square

        var c = self.GetCenter(s.row, s.column );

        this.setPosition(c.x, c.y);

        // restore scale / shadow

        // restore normal display attributes

        this.setAttrs({
            shadow: {
                offset: {
                    x: 3,
                    y: 3
                }
            },
            scale: {
                x: 1,
                y: 1
            },
            alpha:1
        });

        self.pieceLayer.draw();

        // set toSquare

        self.toSquare = { row:s.row, column:s.column };

        // raiser insert event

        self.RaiseEvent( "SlideOrFlyCompleted", [ self.fromSquare.row, self.fromSquare.column, self.toSquare.row, self.toSquare.column ] );
    }
    else
    {

        // return piece to starting square and restore scale/shadow/alpha

        var c = self.GetCenter( self.fromSquare.row, self.fromSquare.column );

        this.transitionTo({
                            x:c.x,
                            y:c.y,
                            duration: 0.5,
                            easing: 'ease-in-out',
                            shadow: {
                                offset: {
                                    x: 3,
                                    y: 3
                                }
                            },
                            scale: {
                                x: 1,
                                y: 1
                            },
                            alpha: 1
                        });

    }

}



// piece being dragged

MorrisBoard.prototype.dragPiece;

// side we are dragging for

MorrisBoard.prototype.dragSide;

// original location of piece that is being dragged, so it can be returned there later if necessary

MorrisBoard.prototype.startDragLocation;

//
// start end drag / drop while waiting for user to insert a piece onto the board
//
MorrisBoard.prototype.OnStartDragInsert = function() {

    // enlarge and increase shadow on piece

    this.setAttrs({
        shadow: {
            offset: {
                x: 6,
                y: 6
            }
        },
        scale: {
            x: 1.1,
            y: 1.1
        },
        alpha: 0.5
    });

    // show targets

    self.targetLayer.show();

    self.targetLayer.draw();

}

//
// when the user releases a piece for insert
//
MorrisBoard.prototype.OnEndDragInsert = function(evt) {

    // hide target layer

    self.targetLayer.hide();

    self.targetLayer.draw();

    // determine where piece was dropped

    var s = self.GetSquareAt(evt);

    // if it was on the board AND it is in the validLocations array then process the move
    // otherwise, return the piece to the hand pile

    if ( s != null && self.IsValidSquare(s.row, s.column ) ) {

        // unsink drag events on piece

        this.off( "dragstart" );

        this.off( "dragend" );

        // set alpha to 1

        this.setAttrs({
            alpha: 1
        });

        // make not draggable

        self.dragPiece.draggable(false);

        // position on square

        var c = self.GetCenter(s.row, s.column );

        self.dragPiece.setPosition(c.x, c.y);

        // remove from in-hand nodes for correct side

        var nodes = self.dragSide == self.WHITE ? self.whiteHandNodes : self.blackHandNodes;

        nodes.pop();

        // set from/toSquare

        self.fromSquare = null;

        self.toSquare = { row:s.row, column:s.column };

        // insert into our pieces node/glyph array

        self.pieceNodes[s.row * self.COLS + s.column] = { glyph:this, row:s.row, column:s.column };

        // redraw layer

        self.pieceLayer.draw();

        // raiser insert event

        self.RaiseEvent( "InsertCompleted", [ s.row, s.column ] );
    }
    else
    {
        // return piece to hand and restore normal shadow and scale

        self.dragPiece.transitionTo({
            x: self.startDragLocation.x,
            y: self.startDragLocation.y,
            duration: 0.5,
            easing: 'ease-in-out',
            scale: { x:1,y:1},
            shadow: { offset: {x:3,y:3} },
            alpha: 1
        });
    }

}

//
// methods for adding listeners and raising events
//
MorrisBoard.prototype.AddListener = function(eventName, callback) {

    if ( this.events[ eventName ] == null )
        this.events[ eventName ] = [];

    this.events[ eventName ].push( callback );

};

//
// key with event name to get array of callbacks
//
MorrisBoard.prototype.events = [];

//
// call all callbacks for the given event
//
MorrisBoard.prototype.RaiseEvent = function(eventName, args) {

    var callbacks = this.events[eventName];

    if ( callbacks != null )
        for (var i = 0, l = callbacks.length; i < l; i++) {
            callbacks[i].apply(null, args);
        }
};

//
// return null or the row / column of the square at the given coordinates
//
MorrisBoard.prototype.GetSquareAt = function( evt ) {

    // determine where piece was dropped

    var coords = this.LocalCoordinates( evt.pageX, evt.pageY );

    // null if outside board area

    if ( coords.x < this.doffset || coords.y < this.doffset.y ||
         coords.x > this.doffset.x + this.sqs * this.COLS || coords.y > this.doffset.y + this.sqs * this.ROWS )
        return null;

    // get row and column

    var row = Math.floor(( coords.y - this.doffset.y ) / this.sqs);

    var col = Math.floor(( coords.x - this.doffset.x ) / this.sqs);

    return { row:row, column:col };
}

//
// get mouse coordinates from an event object in local coordinate space
//
MorrisBoard.prototype.LocalCoordinates = function (x,y) {

    // traverse our parent chain accumulating the offsets of each, then we can apply that to the page mouse coordinates

    var totalOffsetX = 0;

    var totalOffsetY = 0;

    var canvasX = 0;

    var canvasY = 0;

    var currentElement = this.backgroundLayer.canvas;

    do {
        totalOffsetX += currentElement.offsetLeft;

        totalOffsetY += currentElement.offsetTop;
    }
    while (currentElement = currentElement.offsetParent)

    canvasX = x - totalOffsetX;

    canvasY = y - totalOffsetY;

    return { x: canvasX, y: canvasY }
}

//
// return true if row/col are part of the validLocations array
//
MorrisBoard.prototype.IsValidSquare = function( row, col ) {

    if ( this.validLocations == null )
        return false;

    for( var i = 0 ; i < this.validLocations.length ; i+= 2) {

        if ( this.validLocations[i] == row && this.validLocations[i+1] == col )
            return true;
    }

    return false;
}

//
// row/column values for valid locations for the piece being moved by the user
//
MorrisBoard.prototype.validLocations;

// color / side constants

MorrisBoard.prototype.WHITE = 0;

MorrisBoard.prototype.BLACK = 1;

MorrisBoard.prototype.EMPTY = 2;

//
// 7x7 array of piece values ( 0 == WHITE, 1 == BLACK, 2 == EMPTY  )
//
MorrisBoard.prototype.pieces = [

    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2,
    2,2,2,2,2,2,2

];

//
// the Kinetic node representing the piece at this location
//
MorrisBoard.prototype.pieceNodes;

// current number of pieces in hand for each side

MorrisBoard.prototype.whiteHand = 0;

MorrisBoard.prototype.blackHand = 0;

//
// 7x7 array of UI hints for each squares ( 0 == nothing, 1 = circle, 2 = cross  )
//
MorrisBoard.prototype.UI_NOTHING = 0;

MorrisBoard.prototype.UI_CIRCLE = 1;

MorrisBoard.prototype.UI_CROSS = 2;


MorrisBoard.prototype.uiHints = [

    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0
]

//
// 7x7 array of target values, used to indicate red,green or nothing when the user is picking a location
// for a move
//
MorrisBoard.prototype.TARGET_NOTHING = 0;

MorrisBoard.prototype.TARGET_RED = 1;

MorrisBoard.prototype.TARGET_GREEN = 2;

MorrisBoard.prototype.targets = [

    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,
    0,0,0,0,0,0,0
]

// this 7x7 array indicates we squares are playable locations in morris.
// index with row * 7 + col. If you find a 1 the square is played

MorrisBoard.prototype.playable = [

    1,0,0,1,0,0,1,
    0,1,0,1,0,1,0,
    0,0,1,1,1,0,0,
    1,1,1,0,1,1,1,
    0,0,1,1,1,0,0,
    0,1,0,1,0,1,0,
    1,0,0,1,0,0,1
];

// lines should be draw between these locations to represent the board. This array only contains the
// horizontal lines. Just invert row/col to get the vertical lines

MorrisBoard.prototype.lines = [

    {row:0,col:0},{row:0,col:6},
    {row:1,col:1},{row:1,col:5},
    {row:2,col:2},{row:2,col:4},
    {row:3,col:0},{row:3,col:2},
    {row:3,col:4},{row:3,col:6},
    {row:4,col:2},{row:4,col:4},
    {row:5,col:1},{row:5,col:5},
    {row:6,col:0},{row:6,col:6},


];

// width/height of squares

MorrisBoard.prototype.sqs;

// x/y offset from top left of canvas

MorrisBoard.prototype.doffset;

// now of rows and columns in the board

MorrisBoard.prototype.ROWS = 7;

MorrisBoard.prototype.COLS = 7;

// the stage used for rendering

MorrisBoard.prototype.stage;

// the board background layer

MorrisBoard.prototype.backgroundLayer;

// the layer used to indicate green/red dots for valid / invalid locations

MorrisBoard.prototype.targetLayer;

// the layer containing the pieces

MorrisBoard.prototype.pieceLayer;

// the layer containing UI elements e.g. hints about where pieces can be dropped etc.

MorrisBoard.prototype.hintLayer;

