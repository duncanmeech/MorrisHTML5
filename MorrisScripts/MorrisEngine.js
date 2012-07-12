//-----------------------------------------------------------------------------------------------------
// this section is the event handler for the web worker.
// we initialized we create and initialize an actual engine object and save it for later
//-----------------------------------------------------------------------------------------------------


self.onmessage = function ( event ) {

    switch (event.data.name) {

        // the first message, create the engine and initialize

        case "M_Initialize": {

            theEngine = new MorrisEngine();

            this.postMessage({
                name: "M_Initialize_ACK",
                state:theEngine.EngineState(),
                board:theEngine.GetBoard(),
                hand:theEngine.GetHand()
            } );

        } break;

        // start a new game

        case "M_NewGame":{

            theEngine.NewGame();

            this.postMessage({
                name: "M_NewGame_ACK",
                state:theEngine.EngineState(),
                board:theEngine.GetBoard(),
                hand:theEngine.GetHand()
            });

        } break;

        // make a move for the current side to move

        case "M_MakeMove": {

            // set thinking time as passed to us

            theEngine.thinkingTime = event.data.thinkingTime;

            // make the move and post back the PV and the new state of the game

            theEngine.MakeMove();

            this.postMessage({
                name: "M_MakeMove_ACK",
                state:theEngine.EngineState(),
                board:theEngine.GetBoard(),
                hand:theEngine.GetHand(),
                move:theEngine.LastMoveDescriptor(),
                knodes:theEngine.knodes
            });

        } break;

        // play move and return the new state of the board and game

        case "M_PlayUserMove": {

            // make the move

            theEngine.PlayUserMove( event.data.fromRow,
                                    event.data.fromColumn,
                                    event.data.toRow,
                                    event.data.toColumn,
                                    event.data.captureRow,
                                    event.data.captureColumn);


                this.postMessage({
                    name: "M_PlayUserMove_ACK",
                    state:theEngine.EngineState(),
                    board:theEngine.GetBoard(),
                    hand:theEngine.GetHand()
                });


        } break;

        // return state information required to start an insert/slide or fly by the user

        case "M_StartUserMove": {

            this.postMessage({
                name: "M_StartUserMove_ACK",
                state:theEngine.EngineState(),
                board:theEngine.GetBoard(),
                hand:theEngine.GetHand(),
                side:theEngine.side,
                inserts:theEngine.GetInsertLocations(),
                origins:theEngine.GetMoveOrigins()
            });

        } break;

        // return the capture locations for a move played to the given location

        case "M_GetCaptureLocations": {

            // get captures for inserts or other moves

            if ( event.data.fromRow < 0 )
                this.postMessage({

                    name:"M_GetCaptureLocations_ACK",
                    side:theEngine.side,
                    captures:theEngine.GetCaptureLocationsInsert( event.data.toRow, event.data.toColumn )

                })
            else
                this.postMessage({

                    name:"M_GetCaptureLocations_ACK",
                    side:theEngine.side,
                    captures:theEngine.GetCaptureLocationsSlideOrFly( event.data.fromRow, event.data.fromColumn, event.data.toRow, event.data.toColumn )

                })

        } break;

        // return the destinations for a slide or fly move starting from the given row or column

        case "M_GetMoveDestinations": {

            this.postMessage({

                name:"M_GetMoveDestinations_ACK",
                side:theEngine.side,
                destinations:theEngine.GetMoveDestinations( event.data.row, event.data.column )

            });

        } break;


        // remove last move from move history and return new state of the game

        case "M_TakeBack" : {

            theEngine.TakeBack();

            this.postMessage({
                name: "M_TakeBack_ACK",
                state:theEngine.EngineState(),
                board:theEngine.GetBoard(),
                hand:theEngine.GetHand()
            });


        } break;

    }
}

// the instance of Engine class

var theEngine;

//----------------------------------------------------------------------------------------------------------------------
// represent a single square on the morris board. Contains references
// to the neighbor squares and the two possible triples that use this square
//----------------------------------------------------------------------------------------------------------------------
function Square( i, n, si)
{
    this.vindex = i;

    this.neighbors = new Array(n);

    this.triples = new Array(2);

    this.nextConnection = this.nextTriple = 0;

    this.piece = MorrisEngine.EMPTY;

    this.pieceIndex = -1;

    this.squareIndex = si;
}

//
// Form a bi-directional connection betwee ourselves and other other square
//
Square.prototype.ReferenceSquare = function(other) {

   this.neighbors[this.nextConnection++] = other;

    other.neighbors[other.nextConnection++] = this;

}

//
// return row/col of square as a string
//
Square.prototype.RowColumn = function()
{
    return ((this.vindex >> 4) & 0x0F).toString() + "," + (this.vindex & 0x0F).toString();
}

//
// The piece currently in this square [ LIGHT-DARK-EMPTY ]
//
Square.prototype.piece;

//
// The index of the piece in the pieces table of the engine, -1 means there is no piece on this square
//
Square.prototype.pieceIndex;


// Index of the square itself. Row in high nybble, Col in low nybble.
// The is the logical or 'visual' index i.e. where the square appears on a displayed board.
// For move generation / playing etc the squareIndex is used which indexes a valid square in this.squares

Square.prototype.vindex;

//
// Our index in the list of valid squares in the game. There are only 24 valid squares on the standard 7x7 morris board
//
Square.prototype.squareIndex;

//
// 2,3 or 4 squares we are connected to
//
Square.prototype.neighbors;

//
// when adding connections, this is the next available connection
//
Square.prototype.nextConnection = 0;

//
//Each square is part of exactly 2 triples / lines no matter what its location
//
Square.prototype.triples;

//
// When adding connections/triples, this is the index of the next available slot
//
Square.prototype.nextTriple;

//
// Insert reference to triple
//
Square.prototype.ReferenceTriple = function (t)
{
    this.triples[this.nextTriple++] = t;
}

//----------------------------------------------------------------------------------------------------------------------
// Represents a line of 3 connected squares. This structure is used as a fast way of counting
// the number of lines of 0,1,2,3 in a row. Whenever a piece is played into a line the count for that
// color ( including empty ) is increased. Likewise, when a piece is removed the count is decremented.
// By combining the totals for each color ( LIGHT,DARK,EMPTY ) into a single index we can easily
// count the number of lines of formed from any combination of pieces.
// Of course, most interesting from a scoring perspective are open lines of 2 or 3 pieces of either LIGHT or DARK
//----------------------------------------------------------------------------------------------------------------------
function Triple( s1,s2,s3 ) {

    this.squares = new Array(3);

    this.squares[0] = s1;

    this.squares[1] = s2;

    this.squares[2] = s3;

    this.pieceCount = new Array(3);

    this.pieceCount[MorrisEngine.WHITE] = this.pieceCount[MorrisEngine.BLACK] = 0;

    this.pieceCount[MorrisEngine.EMPTY] = 3;

    // set initial line total index which is EMPTY in all positions
    // ( 3 empty squares )

    this.lineTotalIndex = (this.pieceCount[MorrisEngine.WHITE] << 8) | (this.pieceCount[MorrisEngine.BLACK] << 4) | this.pieceCount[MorrisEngine.EMPTY];
}

//
// Add a piece ( only LIGHT or DARK ) to the line
//

Triple.prototype.UpdateSquare = function( oldColor, newColor )
{
    // update total by decrementing count of oldColor and incrementing total for newColor
    // NOTE: old or newColor can be empty

    this.pieceCount[oldColor]--;

    this.pieceCount[newColor]++;

    // update index

    this.lineTotalIndex = ( this.pieceCount[MorrisEngine.WHITE]<<8 ) | ( this.pieceCount[MorrisEngine.BLACK] << 4 ) | this.pieceCount[MorrisEngine.EMPTY];
}


//
// The 3 squares that form line triple/line
//
Triple.prototype.squares;

//
// Count of each piece type currently in this line ( including EMPTY )
//
Triple.prototype.pieceCount;

//
// Line totals index formed by bitwise combining LIGHT,DARK,EMPTY totals
// The index is ( light total << 4 ) | ( dark total << 4 ) | ( empty total )
//
Triple.prototype.lineTotalIndex;

//----------------------------------------------------------------------------------------------------------------------
// HashEntry class for TT
//----------------------------------------------------------------------------------------------------------------------
function HashEntry() {

    this.height = -1;
}

// hash key ... unsigned 31 bit integer

HashEntry.prototype.key;

// depth of search resulting in hash entry

HashEntry.prototype.height;

// type of hash entry

HashEntry.prototype.flags;

// score for this position

HashEntry.prototype.score;

// best move in this position

HashEntry.prototype.bestMove;

//----------------------------------------------------------------------------------------------------------------------
// the engine class itself
//----------------------------------------------------------------------------------------------------------------------

//
// ctor
//
function MorrisEngine() {

    this.NewGame();
}

// nodes searched during search

MorrisEngine.prototype.nodes;

// stop time for iterative deepening

MorrisEngine.prototype.stopTime;

// seconds allocated to think about our move

MorrisEngine.prototype.thinkingTime = 1;

// K nodes processed per second for the last move search

MorrisEngine.prototype.knodes = 0;

//
// Select and make a move for the side to move. Return debug information in a string.
// Uses negascout, iterative deepening, search extensions, transposition tables, history heuristic, move ordering for optimal results.
//
MorrisEngine.prototype.MakeMove = function()
{
    // various debug information ends up in this string

    var report = "";

    // lower height of all T.T. entries so they age off eventually

    this.AgeTT();

    // start time for debugging

    var startTime = new Date();

    // reset nodes

    this.nodes = 0;

    // setup stop time for thinking

    this.stopTime = new Date();

    // stop time is the start time ( MS ) + thinking time ( seconds ) * 1000 )

    this.stopTime.setTime( startTime.getTime() + this.thinkingTime * 1000 );

    // start iterative deepening at depth 1

    var maxDepth = 1;

    // reset abort flags, when true the search stops

    this.abort = false;

    // repeat search to increasing depth until out of time ( and abort flag is set )

    while (this.abort == false)
    {
        // execute search

        var x = this.Negascout(0, maxDepth, -MorrisEngine.WIN, MorrisEngine.WIN);

        // ignore results if search aborted

        if (this.abort == false)
        {
            if (x > MorrisEngine.WIN_APPROXIMATION || x < -(MorrisEngine.WIN_APPROXIMATION))
            {
                report += "Forced Win Detected...search terminated";

                this.abort = true;
            }
        }

        maxDepth += 1;
    }

    report += "\nNodes:" + this.nodes;

    this.knodes = Math.floor( this.nodes / this.thinkingTime / 1000 );

    report += "\nK-Nodes per seconds:" + this.knodes + "K";


    // construct PV from transposition table

    var PV_TT = this.Find_PV_From_TT();

    //report += "\nP.V. From T.T.";

    for (var j = 0; j < PV_TT.length; j++)
       report += "\nPV TT:" + j + " " + this.MoveToString(PV_TT[j].bestMove) + " " + PV_TT[j].score;

    // make best move if there was one

    if ( PV_TT != null && PV_TT.length > 0 ) {

        this.PlayMove(PV_TT[0].bestMove);

        this.AddToHistory(PV_TT[0].bestMove);

    }

    return report;
}

//
// Extract the PV from the TT. This is can inexact due to collisions in the TT keys. Therefore
// there are checks to ensure that moves pulled from the TT are legal within the game context of moves played.
//
MorrisEngine.prototype.Find_PV_From_TT = function() {

    // build the list while playing the PV and harvesting the moves.
    // The list is composed of the hash entries corresponding to the position. .bestMove contains the move
    // for the side to move in that position

    var PV = [];

    // mod the game hash with the size of the number

    var h = this.TT[this.side][ this.gameHash % MorrisEngine.TT_SIZE ];

    // we track the hash entries added to the PV. If we find a duplicate we terminate otherwise the program would end up in
    // an infinite loop

    var pvKeys = new Object();

    while (h != null && h.height >= 0 && h.key == this.gameHash )
    {
        // add key so we don't get into a infinite loop

        pvKeys[ h.key.toString() ] = h;

        // ensure move is legal ( T.T. type 2 errors are possible )

        var legalMoves = this.GetLegalMoves();

        if ( legalMoves.indexOf(h.bestMove) < 0 )
            break;

        PV.push(h);

        this.PlayMove(h.bestMove);

        h = this.TT[this.side][ this.gameHash % MorrisEngine.TT_SIZE ];

        // if we have seen this key before or the hash table entry is used ( key == null ) bail before we get stuck

        if (h.key == null || pvKeys[h.key.toString()] != null)
            break;
    }

    // don't forget to un-play the PV!

    var i;

    for (i = PV.length - 1; i >= 0; i--)
        this.UnPlayMove(PV[i].bestMove);

    // return the PV

    return PV;
}

//
// string representation of a move for debugging
//
MorrisEngine.prototype.MoveToString = function(m)
{

    // determine if a capture

    var capture = m & MorrisEngine.MOVE_CAPTURE_FLAG;

    // handle according to type

    var moveType = m & MorrisEngine.MOVE_TYPE_MASK;

    var move = moveType == MorrisEngine.MOVE_INSERT ? "insert " : ( moveType == MorrisEngine.MOVE_SLIDE ? "slide " : "from " );

    if ( moveType == MorrisEngine.MOVE_INSERT )
    {
        move += this.squares[this.ToSquare(m)].RowColumn();
    }
    else
    {
        move += this.squares[this.FromSquare(m)].RowColumn() + " - " + this.squares[this.ToSquare(m)].RowColumn();
    }

    if (capture != 0)
    {
        move += " X " + this.squares[this.CaptureSquare(m)].RowColumn();
    }

    return move;
}


//
// NegaScout search procedure
//
MorrisEngine.prototype.Negascout = function( ply, maxDepth, alpha, beta)
{
    // switch to quiet search ( capture only ) at search limit

    if (ply == maxDepth)
        return this.QuietSearch(ply, alpha, beta);

    // bump node count

    this.nodes++;

    // if we have reached the time limit set the abort flag and bail, score will not be used so any value can be returned

    if ( ( this.nodes & 0x0FFF ) == 0  )
    {
        var now = new Date();

        if ( now.getTime() > this.stopTime.getTime() ) {

            this.abort = true;

            return 0;
        }
    }

    // at this point the algorithm should really check for 3-fold repetition of positions since that is a draw.
    // In practise this don't occur enough ( and the program won't play a bad move if it misses a draw ) to be
    // worth the CPU expense ( although a cheaper version that looks for 3 fold repetition in the last 6 plys would work )
    // ---If you add a 3-fold check then just return zero to indicate a drawn position

    // record alpha at start of procedure, this might be used later to update the TT

    var oldAlpha = alpha;

    // height of search tree is simple maxDepth - ply ( since ply always increases in this program )

    var height = maxDepth - ply;

    // retrieve TT entry for current position and side. Each entry is initialized to a depth of -1
    // that first test will always fail for unused entries

    var ttEntry = this.TT[this.side][this.gameHash % MorrisEngine.TT_SIZE];

    // depth must be an improvement AND the hash code must match

    var bestMove = MorrisEngine.NULL_MOVE;

    if (ttEntry.key == this.gameHash)
    {
        // if the TT entry was search to at least the height of the current search then we can
        // use to get a score or set new bounds for a/b

        if (ttEntry.height >= height)
        {
            if (ttEntry.flags == MorrisEngine.TT_EXACT)
            {
                return ttEntry.score;
            }
            else
            if (ttEntry.flags == MorrisEngine.TT_LOWER)
                alpha = Math.max(alpha, ttEntry.score);
            else
            if (ttEntry.flags == MorrisEngine.TT_UPPER)
                beta = Math.min(beta, ttEntry.score);

        }

        // regardless of whether the TT is deeper result that present we can still seed the bestMove to get better move ordering

        bestMove = ttEntry.bestMove;
    }

    // the TT code above might have set a/b so that a cutoff occurs, the following check handles that

    if (!(alpha >= beta))
    {

        // if the piece count is < 3 this is a lost game as well

        if (this.pieceTotals[this.side] + this.inHand[this.side] < 3)
            return -MorrisEngine.WIN + ply;

        // get captures

        var count = this.GenerateLegalMoves(ply);

        // if side to move has no moves they lose

        if (count == 0)
            return -MorrisEngine.WIN + ply;

        // negascout initial window is (-β, -α)

        var b = beta;

        // try all moves

        var i;

        for (i = 0; i < count; i++)
        {
            // bring the next best move to the top of the legal move list.
            // The TT best move, if valid, will always come back first

            this.SortMove(ply, count, i, bestMove);

            // get best move to try next

            var m = this.legalMoves[MorrisEngine.MAX_MOVES * ply + i];

            // play move

            this.PlayMove(m);

            // iterate deeper, if this is the first move then perform a full width search

            var search = -this.Negascout(ply + 1, maxDepth, -b, -alpha);

            // wider window required ?

            if (i > 0 && (alpha < search && search < beta))
            {
                search = -this.Negascout(ply + 1, maxDepth, -beta, -alpha);
            }

            // unplay the move

            this.UnPlayMove(m);

            // if we are aborting return now

            if (this.abort == true)
                return 0;

            // update search  values

            if (search > alpha)
            {
                // update best move

                bestMove = m;

                // update history for this move

                this.history[this.FromSquare(m), this.ToSquare(m)] += height << height;

                // update alpha/beta

                alpha = search;

                // alpha/beta pruning

                if (alpha >= beta)
                    break;

            }

            b = alpha + 1;
        }
    }

    // overwrite conditions:
    // - height of search tree is better than the current entry ( -1 indicates entry is unused )
    // - a move was found and its not a PASS
    //
    // HOWEVER, if the move number of the entry indicates an older search than present then we always overwrite
    // since older position may no longer be relevant to the search

    if (bestMove != MorrisEngine.NULL_MOVE && height >= ttEntry.height )
    {
        if (alpha <= oldAlpha)
            ttEntry.flags = MorrisEngine.TT_UPPER;
        else
        if (alpha >= beta)
            ttEntry.flags = MorrisEngine.TT_LOWER;
        else
            ttEntry.flags = MorrisEngine.TT_EXACT;

        ttEntry.bestMove = bestMove;

        ttEntry.height = height;

        ttEntry.score = alpha;

        ttEntry.key = this.gameHash;
    }

    // return score

    return alpha;
}

//
// Pull the best move according to the history tables to the top of the move list.
// if a bestMove is supplied from the TT, that is given preference to the history table
//
MorrisEngine.prototype.SortMove = function(ply, moves, i, bestMove)
{
    var BASE = MorrisEngine.MAX_MOVES * ply;

    var bestScore = -1;

    var bestIndex = -1;

    for (var j = i; j < moves; j++)
    {
        if (this.legalMoves[BASE + j] == bestMove)
        {
            bestIndex = j;

            break;
        }

        if (this.legalMovesScore[BASE + j] > bestScore)
        {
            bestScore = this.legalMovesScore[BASE + j];

            bestIndex = j;
        }
    }

    // swap highest scoring move with move at current head of list

    if (bestIndex >= 0)
    {
        var temp = this.legalMoves[BASE + bestIndex];

        this.legalMoves[BASE + bestIndex] = this.legalMoves[BASE + i];

        this.legalMoves[BASE + i] = temp;


        temp = this.legalMovesScore[BASE + bestIndex];

        this.legalMovesScore[BASE + bestIndex] = this.legalMovesScore[BASE + i];

        this.legalMovesScore[BASE + i] = temp;
    }
}

//
// Return the terminal score for the side to move. This only checks if a sides pieces are less than 3.
// The position may also be terminal if the side to move has no moves but that is discovered later in the Negamax procedure
//
MorrisEngine.prototype.TerminalScore = function()
{
    // if less than two pieces then game over

    if (this.pieceTotals[MorrisEngine.BLACK] + this.inHand[MorrisEngine.BLACK] < 3)
    {
        // light wins

        return this.side == MorrisEngine.WHITE ? MorrisEngine.WIN : -MorrisEngine.WIN;
    }


    if (this.pieceTotals[MorrisEngine.WHITE] + this.inHand[MorrisEngine.WHITE] < 3)
    {
        // dark win

        return this.side == MorrisEngine.BLACK ? -MorrisEngine.WIN : MorrisEngine.WIN;
    }

    return 0;
}

// multipliers for the three elements of the score function. Adjust these to create engines with different
// characteristics ( although the defaults play the strongest game as far as I can tell )
// NOTE: How freedom i.e. mobility,  scores higher than raw material...this is common in many games e.g. Reversi et al )

MorrisEngine.materialMULTIPLIER = 1;

MorrisEngine.freedomMULTIPLIER = 2;

MorrisEngine.tripleMULTIPLIER = 10;

//
// Return material score only for now, for side to move. This is called from Negamax so
// for mobility calculations we need the depth and we already know the moves for .sides
//
MorrisEngine.prototype.NonTerminalScore = function()
{
    // material difference

    var pieceScore = (this.pieceTotals[MorrisEngine.WHITE] + this.inHand[MorrisEngine.WHITE]) - (this.pieceTotals[MorrisEngine.BLACK] + this.inHand[MorrisEngine.BLACK]);

    pieceScore *= MorrisEngine.materialMULTIPLIER;

    // difference in number of juxtaposed free squares for each side

    var freedom = this.Freedom();

    freedom *= MorrisEngine.freedomMULTIPLIER;

    // differential of triples ( mills )

    var triples = (this.lineTotals[MorrisEngine.WHITE_LINE_3] - this.lineTotals[MorrisEngine.BLACK_LINE_3]);

    triples *= MorrisEngine.tripleMULTIPLIER;

    // combine the elements together

    var score = pieceScore + freedom + triples;

    // flip score for black to move

    if (this.side == MorrisEngine.BLACK)
        score *= -1;

    return score;
}

//
// Counts the number of juxtaposed open squares next to each of each color
//
MorrisEngine.prototype.Freedom = function()
{
    // uses groups to calculate scores

    this.positionalScore[MorrisEngine.WHITE] = this.positionalScore[MorrisEngine.BLACK] = 0;

    // uses empty squares next to pieces to calculate scores

    for (var c = MorrisEngine.WHITE; c <= MorrisEngine.BLACK; c++)
    {
        // for each potential piece on the board

        for (var i = 0; i < 9; i++)
        {
            // get index into pieces array

            var index = c * 9 + i;

            var pieceIndex = this.pieces[index];

            if (pieceIndex >= 0)
            {
                // get square this piece is on

                var s = this.squares[pieceIndex];

                // add number of empty neighbors

                for( var j = 0 ; j < s.neighbors.length ; j++) {

                    n = s.neighbors[j];

                    if (n.piece == MorrisEngine.EMPTY)
                        this.positionalScore[c]++;
                }
            }
        }
    }

    return this.positionalScore[MorrisEngine.WHITE] - this.positionalScore[MorrisEngine.BLACK];
}


/// <summary>
/// For accumulating positional scores
/// </summary>
MorrisEngine.prototype.positionalScore = [];


//
// When the search limit is reached we limit the search to an exhaustive search of captures only.
// Captures quickly run out ( unlike say chess ) so the number of 'quiet' nodes searched is not explosive like chess and no pruning is performed.
// Quiet search is also necessary since we don't do a repetition check in the main negascout loop and so certain branches would get repeated to infinite depth
// with each side making and unmaking the same moves repeatedly.
//
MorrisEngine.prototype.QuietSearch = function(ply, alpha, beta)
{
    // bump node count

    this.nodes++;

    if ( ( this.nodes & 0x0FFF ) == 0  )
    {
        var now = new Date();

        if ( now.getTime() > this.stopTime.getTime() ) {

            this.abort = true;

            return 0;
        }
    }

    // absolute search limit reached ?

    if (ply == MorrisEngine.MAX_DEPTH)
        return this.NonTerminalScore();

    // use pat score to update a/b http://chessprogramming.wikispaces.com/Quiescence+Search

    var stand_pat = this.NonTerminalScore();

    if (stand_pat >= beta)
        return beta;

    if (alpha < stand_pat)
        alpha = stand_pat;

    // get captures

    var captures = this.GenerateLegalCaptureMoves(ply);

    // if there are no captures return the incremental score unless the side to move has no moves at all ( they lose )

    if (captures == 0)
    {
        if (this.AnyLegalMoves(ply) == false)
            return -MorrisEngine.WIN + ply;

        return stand_pat;
    }

    // try all moves

    for (var i = 0; i < captures; i++)
    {
        // bring the next best move to the top of the legal move list.
        // There are no T.T. moves in QuietSearch

        this.SortMove(ply, captures, i );

        // get best move to try next

        var m = this.legalMoves[MorrisEngine.MAX_MOVES * ply + i];

        // play move

        this.PlayMove(m);

        // iterate deeper

        var score = -this.QuietSearch(ply + 1, -beta, -alpha);

        // unplay the move

        this.UnPlayMove(m);

        // if we are aborting return now

        if (this.abort == true)
            return 0;

        // update search values

        if (score > alpha)
        {
            if (score >= beta)
                return beta;

            alpha = score;
        }

    }

    // return score

    return alpha;
}

//
// Simply returns true if any legal moves are possible
//
MorrisEngine.prototype.AnyLegalMoves = function(depth)
{
    // we can always insert if we have pieces in hand

    if (this.inHand[this.side] > 0)
        return true;

    // if we are able to fly then legal moves are always possible

    if (this.pieceTotals[this.side] == 3)
        return true;

    // slides are played when we have no disks in hand BUT before we are reduced to <= 3 tiles

    if (this.pieceTotals[this.side] > 3)
    {
        // try to slide all pieces of the current side

        for (var i = 0; i < 9; i++)
        {
            // check piece 0..8 for current side, it must of course be on the board!

            var pindex = this.pieces[this.side * 9 + i];

            if (pindex != -1)
            {
                // get the square this piece is on

                var from = this.squares[pindex];

                // look for empty neighbors

                for (var n = 0; n < from.neighbors.length; n++)
                {
                    var to = from.neighbors[n];

                    if (to.piece == MorrisEngine.EMPTY)
                        return true;
                }
            }
        }
    }


    // if here no legal move was found

    return false;
}

//
// Identical to GenerateLegalMoves but only generates capture moves
//
MorrisEngine.prototype.GenerateLegalCaptureMoves = function(depth)
{
    var moveIndex = MorrisEngine.MAX_MOVES * depth;

    if (this.inHand[this.side] > 0)
    {
        // generate INSERT moves

        // try all vacant squares

        for (var i = 0; i < this.squares.length; i++)
        {
            var s = this.squares[i];

            if (s.piece == MorrisEngine.EMPTY)
            {
                // create move with 'to' set to where the insert will happen. The from square is set to the special constants that indicates off the board

                var m = MorrisEngine.MOVE_INSERT | (s.squareIndex << 16) | (MorrisEngine.OFF_BOARD << 8);

                if (this.WillTripleInsert(this.squares[i], this.side) == true)
                {
                    // this will complete a line so we get to capture

                    // insert all captures of opponent pieces

                    var captures = 0;

                    for (var c = 0; c < 9; c++)
                    {
                        // only if this piece currently on board

                        var pieceIndex = this.otherSide * 9 + c;

                        var captureIndex = this.pieces[pieceIndex];

                        if (captureIndex != -1)
                        {
                            // cannot remove pieces from a triple, so check for that

                            if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                            {
                                // add move to list

                                this.legalMoves[moveIndex] = m | (captureIndex << 24) | MorrisEngine.MOVE_CAPTURE_FLAG;

                                this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                captures++;
                            }
                        }
                    }

                    // if no captures were possible because all of the opponents pieces are in triples then allow capture of pieces
                    // in triples.

                    if (captures == 0)
                    {
                        for (var c = 0; c < 9; c++)
                        {
                            // only if this piece currently on board

                            var pieceIndex = this.otherSide * 9 + c;

                            var captureIndex = this.pieces[pieceIndex];

                            if (captureIndex != -1)
                            {
                                this.legalMoves[moveIndex] = m | (captureIndex << 24) | MorrisEngine.MOVE_CAPTURE_FLAG;

                                this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                            }
                        }
                    }
                }
            }
        }

        // return number of moves

        return moveIndex - (MorrisEngine.MAX_MOVES * depth);
    }


    // slides are played when we have no disks in hand BUT before we are reduced to <= 3 tiles

    if (this.pieceTotals[this.side] > 3)
    {
        // try to slide all pieces of the current side

        for (var i = 0; i < 9; i++)
        {
            // check piece 0..8 for current side, it must of course be on the board!

            var pindex = this.pieces[this.side * 9 + i];

            if (pindex != -1)
            {
                // get the square this piece is on

                var from = this.squares[pindex];

                // look for empty neighbors

                for (var n = 0; n < from.neighbors.length; n++)
                {
                    var to = from.neighbors[n];

                    if (to.piece == MorrisEngine.EMPTY)
                    {
                        // this is valid slide, now check if the slide will form a triple

                        if (this.WillTripleSlideOrFly(from, to, this.side) == true)
                        {
                            // a capturing slide...add moves that capture each of the opponents pieces except those in a mill

                            var captures = 0;

                            for (var c = 0; c < 9; c++)
                            {
                                // only if this piece currently on board

                                var pieceIndex = this.otherSide * 9 + c;

                                var captureIndex = this.pieces[pieceIndex];

                                if (captureIndex != -1)
                                {
                                    // cannot remove a piece that is part of a triple

                                    if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                                    {
                                        // add move to list

                                        this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_SLIDE;

                                        this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                        captures++;
                                    }
                                }
                            }

                            // if no captures possible without disturbing a triple then allow captures of triples

                            if (captures == 0)
                            {
                                for (var c = 0; c < 9; c++)
                                {
                                    // only if this piece currently on board

                                    var pieceIndex = this.otherSide * 9 + c;

                                    varcaptureIndex = this.pieces[pieceIndex];

                                    if (captureIndex != -1)
                                    {
                                        this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_SLIDE;

                                        this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // return number of moves added to list

        return moveIndex - (MorrisEngine.MAX_MOVES * depth);
    }


    // try to fly all pieces of the current side

    for (var i = 0; i < 9; i++)
    {
        // check piece 0..8 for current side, it must of course be on the board!

        var pindex = this.pieces[this.side * 9 + i];

        if (pindex != -1)
        {
            // get the square this piece is on

            var from = this.squares[pindex];

            // look for empty squares anywhere on the board

            for (var t = 0; t < this.squares.length; t++)
            {
                var to = this.squares[t];

                if (to.piece == MorrisEngine.EMPTY)
                {
                    // this is valid fly, now check if the fly will form a triple

                    if (this.WillTripleSlideOrFly(from, to, this.side) == true)
                    {
                        // a capturing fly....add moves that capture each of the opponents pieces except those in a mill

                        var captures = 0;

                        for (var c = 0; c < 9; c++)
                        {
                            // only if this piece currently on board

                            var pieceIndex = this.otherSide * 9 + c;

                            var captureIndex = this.pieces[pieceIndex];

                            if (captureIndex != -1)
                            {
                                // cannot capture part of a triple

                                if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                                {
                                    // add move to list

                                    this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_FLY;

                                    this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                    captures++;
                                }
                            }
                        }

                        // allow captures of triples if this is the only captures possible

                        if (captures == 0)
                        {
                            for (var c = 0; c < 9; c++)
                            {
                                // only if this piece currently on board

                                var pieceIndex = this.otherSide * 9 + c;

                                var captureIndex = this.pieces[pieceIndex];

                                if (captureIndex != -1)
                                {
                                    this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_FLY;

                                    this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // return number of moves added to list

    return moveIndex - (MorrisEngine.MAX_MOVES * depth);

}

//
// For the UI and PV construction gets a list of legal moves that can be played. Too slow for use in Negascout
//
MorrisEngine.prototype.GetLegalMoves = function()
{
    var moves = [];

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        moves.push(this.legalMoves[i]);
    }

    return moves;
}

//
// Generate legal moves for the side to move at the given depth. Returns the number of moves.
// Moves are stored in legalMoves for the given depth ( i.e. starting at MAX_MOVES * depth ).
//
MorrisEngine.prototype.GenerateLegalMoves = function(depth)
{

    var i, m, n, c, s, t, captures, pieceIndex, captureIndex, pindex, from, to;

    // base index for moves at this depth

    var moveIndex = MorrisEngine.MAX_MOVES * depth;

    // generate INSERT moves if the side to move has pieces in hand

    if (this.inHand[this.side] > 0)
    {
        // try all vacant squares

        for (i = 0; i < this.squares.length; i++)
        {
            s = this.squares[i];

            if (s.piece == MorrisEngine.EMPTY)
            {
                // create move with 'to' set to where the insert will happen. The from square is set to the special constants that indicates off the board

                m = MorrisEngine.MOVE_INSERT | (s.squareIndex << 16) | ( MorrisEngine.OFF_BOARD << 8 );

                if (this.WillTripleInsert(this.squares[i], this.side) == true)
                {
                    // this will complete a line so we get to capture

                    // insert all captures of opponent pieces

                    captures = 0;

                    for (c = 0; c < 9; c++)
                    {
                        // only if this piece currently on board

                        pieceIndex = this.otherSide * 9 + c;

                        captureIndex = this.pieces[pieceIndex];

                        if (captureIndex != -1)
                        {
                            // cannot remove pieces from a triple, so check for that

                            if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                            {
                                // add move to list

                                this.legalMoves[moveIndex] = m | (captureIndex << 24) | MorrisEngine.MOVE_CAPTURE_FLAG;

                                this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                captures++;
                            }
                        }
                    }

                    // if no captures were possible because all of the opponents pieces are in triples then allow capture of pieces
                    // in triples.

                    if (captures == 0)
                    {
                        for (c = 0; c < 9; c++)
                        {
                            // only if this piece currently on board

                            pieceIndex = this.otherSide * 9 + c;

                            captureIndex = this.pieces[pieceIndex];

                            if (captureIndex != -1)
                            {
                                this.legalMoves[moveIndex] = m | (captureIndex << 24) | MorrisEngine.MOVE_CAPTURE_FLAG;

                                this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                            }
                        }
                    }
                }
                else
                {

                    // add move to list, pull score from history table

                    this.legalMoves[moveIndex] = m;

                    // apply history score for this square

                    this.legalMovesScore[moveIndex++] = this.history[this.FromSquare(m),this.ToSquare(m)];
                }
            }
        }

        // return number of moves

        return moveIndex - (MorrisEngine.MAX_MOVES * depth);
    }

    // slides are played when we have no disks in hand BUT before we are reduced to <= 3 tiles

    if (this.pieceTotals[this.side] > 3)
    {
        // try to slide all pieces of the current side

        for (i = 0; i < 9; i++)
        {
            // check piece 0..8 for current side, it must of course be on the board!

            pindex = this.pieces[this.side * 9 + i];

            if (pindex != -1)
            {
                // get the square this piece is on

                from = this.squares[pindex];

                // look for empty neighbors

                for (n = 0; n < from.neighbors.length; n++)
                {
                    to = from.neighbors[n];

                    if (to.piece == MorrisEngine.EMPTY)
                    {
                        // this is valid slide, now check if the slide will form a triple

                        if (this.WillTripleSlideOrFly(from, to, this.side) == true)
                        {
                            // a capturing slide...add moves that capture each of the opponents pieces except those in a mill

                            captures = 0;

                            for (c = 0; c < 9; c++)
                            {
                                // only if this piece currently on board

                                pieceIndex = this.otherSide * 9 + c;

                                captureIndex = this.pieces[pieceIndex];

                                if (captureIndex != -1)
                                {
                                    // cannot remove a piece that is part of a triple

                                    if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                                    {
                                        // add move to list

                                        this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_SLIDE;

                                        this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                        captures++;
                                    }
                                }
                            }

                            // if no captures possible without disturbing a triple then allow captures of triples

                            if (captures == 0)
                            {
                                for (c = 0; c < 9; c++)
                                {
                                    // only if this piece currently on board

                                    pieceIndex = this.otherSide * 9 + c;

                                    captureIndex = this.pieces[pieceIndex];

                                    if (captureIndex != -1)
                                    {
                                        this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_SLIDE;

                                        this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                                    }
                                }
                            }
                        }
                        else
                        {
                            // a non capturing slide, pull score from history table

                            this.legalMoves[moveIndex] = (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_SLIDE;

                            this.legalMovesScore[moveIndex++] = this.history[from.squareIndex, to.squareIndex];
                        }
                    }
                }
            }
        }

        // return number of moves added to list

        return moveIndex - (MorrisEngine.MAX_MOVES * depth);
    }

    // try to fly all pieces of the current side

    for (i = 0; i < 9; i++)
    {
        // check piece 0..8 for current side, it must of course be on the board!

        pindex = this.pieces[this.side * 9 + i];

        if (pindex != -1)
        {
            // get the square this piece is on

            from = this.squares[pindex];

            // look for empty squares anywhere on the board

            for (t = 0; t < this.squares.length ; t++)
            {
                to = this.squares[t];

                if (to.piece == MorrisEngine.EMPTY)
                {
                    // this is valid fly, now check if the fly will form a triple

                    if (this.WillTripleSlideOrFly(from, to, this.side) == true)
                    {
                        // a capturing fly....add moves that capture each of the opponents pieces except those in a mill

                        captures = 0;

                        for (c = 0; c < 9; c++)
                        {
                            // only if this piece currently on board

                            pieceIndex = this.otherSide * 9 + c;

                            captureIndex = this.pieces[pieceIndex];

                            if (captureIndex != -1)
                            {
                                // cannot capture part of a triple

                                if (this.WillUnTriple(this.squares[captureIndex], this.otherSide) == false)
                                {
                                    // add move to list

                                    this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_FLY;

                                    this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;

                                    captures++;
                                }
                            }
                        }

                        // allow captures of triples if this is the only captures possible

                        if (captures == 0)
                        {
                            for (c = 0; c < 9; c++)
                            {
                                // only if this piece currently on board

                                pieceIndex = this.otherSide * 9 + c;

                                captureIndex = this.pieces[pieceIndex];

                                if (captureIndex != -1)
                                {
                                    this.legalMoves[moveIndex] = (captureIndex << 24) | (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_CAPTURE_FLAG | MorrisEngine.MOVE_FLY;

                                    this.legalMovesScore[moveIndex++] = MorrisEngine.MOVE_CAPTURE_SCORE;
                                }
                            }
                        }
                    }
                    else
                    {
                        // a non capturing slide, pull score from history

                        this.legalMoves[moveIndex] = (to.squareIndex << 16) | (from.squareIndex << 8) | MorrisEngine.MOVE_FLY;

                        this.legalMovesScore[moveIndex++] = this.history[from.squareIndex, to.squareIndex];

                    }
                }
            }
        }
    }

    // return number of moves added to list

    return moveIndex - (MorrisEngine.MAX_MOVES * depth);

}

//
// Return true if playing the given color into the given square will make a new triple. This assumes the square is currently empty etc.
// This version only checks if each triple is currently composed to 2 disks. Therefore it is only correct when inserting new pieces
// into the game. When sliding a flying a piece you might be moving from one location in a line to anther in the same line
// so there is a separate check for that.
//
MorrisEngine.prototype.WillTripleInsert = function(s, color)
{
    // we test this be checking if the square is currently part of the open line of 2

    if (color == MorrisEngine.WHITE)
    {
        if (s.triples[0].lineTotalIndex == MorrisEngine.WHITE_LINE_2 ||
            s.triples[1].lineTotalIndex == MorrisEngine.WHITE_LINE_2)
            return true;

        return false;
    }

    if (s.triples[0].lineTotalIndex == MorrisEngine.BLACK_LINE_2 ||
        s.triples[1].lineTotalIndex == MorrisEngine.BLACK_LINE_2)
        return true;

    return false;
}

//
// As above but is correct when sliding or flying from one square to another. Specifically it checks that the from/to square are not
// part of the same triple
//
MorrisEngine.prototype.WillTripleSlideOrFly = function(f, t, color)
{
    // we test this be checking if the square is currently part of the open line of 2

    if (color == MorrisEngine.WHITE)
    {
        if (t.triples[0].lineTotalIndex == MorrisEngine.WHITE_LINE_2 )
        {
            // the from square must not be part of the triple

            if (!(t.triples[0].squares[0] == f || t.triples[0].squares[1] == f || ( t.triples[0].squares[2] ==f )))
                return true;
        }

        if (t.triples[1].lineTotalIndex == MorrisEngine.WHITE_LINE_2 )
        {
            // the from square must not be part of the triple

            if (!(t.triples[1].squares[0] == f || t.triples[1].squares[1] == f || ( t.triples[1].squares[2] ==f )))
                return true;
        }

        return false;
    }

    if (t.triples[0].lineTotalIndex == MorrisEngine.BLACK_LINE_2)
    {
        // the from square must not be part of the triple

        if (!(t.triples[0].squares[0] == f || t.triples[0].squares[1] == f || (t.triples[0].squares[2] == f)))
            return true;
    }

    if (t.triples[1].lineTotalIndex == MorrisEngine.BLACK_LINE_2)
    {
        // the from square must not be part of the triple

        if (!(t.triples[1].squares[0] == f || t.triples[1].squares[1] == f || (t.triples[1].squares[2] == f)))
            return true;
    }

    return false;
}

//
// Return true if move a piece of the given color from the triples associated with the given square would undo a triple.
//
MorrisEngine.prototype.WillUnTriple = function(s, color)
{
    // we test this be checking if the square is currently part of a triple for 'color'

    if (color == MorrisEngine.WHITE)
    {
        if (s.triples[0].lineTotalIndex == MorrisEngine.WHITE_LINE_3 ||
            s.triples[1].lineTotalIndex == MorrisEngine.WHITE_LINE_3)
            return true;

        return false;
    }

    if (s.triples[0].lineTotalIndex == MorrisEngine.BLACK_LINE_3 ||
        s.triples[1].lineTotalIndex == MorrisEngine.BLACK_LINE_3)
        return true;

    return false;
}

//
// reset or create all data structures for a new game
//
MorrisEngine.prototype.NewGame = function()
{
    // reset positions history

    this.nextPositionHistory = 0;

    // keep a separate list of the valid squares for faster lookup

    this.squares = [];

    this.squaresIndex = 0;

    // add all valid squares on the board

    this.AddSquare(0x00,2);

    this.AddSquare(0x03,3);

    this.AddSquare(0x06,2);


    this.AddSquare(0x11,2);

    this.AddSquare(0x13,4);

    this.AddSquare(0x15,2);


    this.AddSquare(0x22,2);

    this.AddSquare(0x23,3);

    this.AddSquare(0x24,2);


    this.AddSquare(0x30,3);

    this.AddSquare(0x31,4);

    this.AddSquare(0x32,3);

    this.AddSquare(0x34,3);

    this.AddSquare(0x35,4);

    this.AddSquare(0x36,3);


    this.AddSquare(0x42,2);

    this.AddSquare(0x43,3);

    this.AddSquare(0x44,2);


    this.AddSquare(0x51,2);

    this.AddSquare(0x53,4);

    this.AddSquare(0x55,2);


    this.AddSquare(0x60,2);

    this.AddSquare(0x63,3);

    this.AddSquare(0x66,2);

    // create line totals array.

    this.lineTotals = [];

    var i;

    for( i = 0 ; i < 0x400 ; i++)
        this.lineTotals[i] = 0;

    // create triples array, there 8 vertical and 8 horizontal lines

    this.triples = [];

    // used to insert the next new triple at the right place

    this.tripleIndex = 0;

    // form connections between lines of three squares

    // horizontal lines

    this.AddTriple(0x00, 0x03, 0x06);

    this.AddTriple(0x11, 0x13, 0x15);

    this.AddTriple(0x22, 0x23, 0x24);

    this.AddTriple(0x30, 0x31, 0x32);

    this.AddTriple(0x34, 0x35, 0x36);

    this.AddTriple(0x42, 0x43, 0x44);

    this.AddTriple(0x51, 0x53, 0x55);

    this.AddTriple(0x60, 0x63, 0x66);

    // vertical

    this.AddTriple(0x00, 0x30, 0x60);

    this.AddTriple(0x11, 0x31, 0x51);

    this.AddTriple(0x22, 0x32, 0x42);

    this.AddTriple(0x03, 0x13, 0x23);

    this.AddTriple(0x43, 0x53, 0x63);

    this.AddTriple(0x24, 0x34, 0x44);

    this.AddTriple(0x15, 0x35, 0x55);

    this.AddTriple(0x06, 0x36, 0x66);


    // set piece totals

    this.pieceTotals = new Array(3);

    this.pieceTotals[MorrisEngine.WHITE] = this.pieceTotals[MorrisEngine.BLACK] = 0;

    this.pieceTotals[MorrisEngine.EMPTY] = 24;

    // create pieces array

    this.pieces = new Array(18);

    // set all to -1 to indicate not on the board currently

    for ( i = 0; i < this.pieces.length; i++)
        this.pieces[i] = -1;

    // create legal move structure

    this.legalMoves = new Array(MorrisEngine.MAX_MOVES * MorrisEngine.MAX_DEPTH);

    this.legalMovesScore = new Array(MorrisEngine.MAX_MOVES * MorrisEngine.MAX_DEPTH);

    for( i = 0 ; i < MorrisEngine.MAX_MOVES * MorrisEngine.MAX_DEPTH ; i++ )
        this.legalMoves[i] = this.legalMovesScore = 0;

    // reset number of pieces in hand

    this.inHand = new Array(2);

    this.inHand[0] = this.inHand[1] = 9;

    // set side to move

    this.side = MorrisEngine.WHITE;

    this.otherSide = MorrisEngine.BLACK;

    // initialize game hash

    this.SeedHashAndTT();

    // reset game history

    this.playedMoves = [];

    this.positionHistory = [];

    // reset history heuristic tables

    this.history = new Array( MorrisEngine.HISTORY_DIM );

    for( var h = 0 ; h < MorrisEngine.HISTORY_DIM ; h++ )
    {
        this.history[h] = new Array( MorrisEngine.HISTORY_DIM );

        for( i = 0 ; i < MorrisEngine.HISTORY_DIM ; i++)
            this.history[h][i] = 0;
    }

}

//
// play all inserts so we can start testing slides, this only works with a clean board and assumes no captures
//
MorrisEngine.prototype.PlayAllInserts = function()
{
    for( var i = 0 ; i < 9*2 ; i++ )
    {
        var s = this.squares[i];

        var r = ( s.vindex >> 4 ) & 0x0F;

        var c = s.vindex & 0x0F;

        this.PlayUserMove( -1,-1, r,c, -1, -1 );
    }
}

//
// side to move and side not to move
//
MorrisEngine.prototype.side;

MorrisEngine.prototype.otherSide;

//
// history of played moves and associated position hashes
//
MorrisEngine.prototype.playedMoves = [];

MorrisEngine.prototype.positionHistory = [];

//
// add the given move and position hash to the history of moves. So allows for takeback.
// we also record the current game hash so we can check for draw by repetition
//
MorrisEngine.prototype.AddToHistory = function(m,h)
{
    // add to move list

    this.playedMoves.push(m);

    // increment count for this position in reps table

    this.positionHistory.push(h);
}

//
// take back last move played in history
//
MorrisEngine.prototype.TakeBack = function() {

    if ( this.playedMoves != null && this.playedMoves.length > 0 ) {
        this.UnPlayMove( this.playedMoves.pop() );
    }
}

//
// if there is one return a UI friendly object that defines the move.
// Format:
// .MoveType = [ "Insert", "SlideOrFly" ]
// .FromSquare = { row:xxx, column:xxx } OR undefined if an insert
// .ToSquare = { row:xxx, column:xxx } always present
// .IsCapture = true | false;
// .CaptureSquare = if .IsCapture == true then = { row:xxx, column:xxx }
// .White = true or false. True if the move was played by white, otherwise false
//
MorrisEngine.prototype.LastMoveDescriptor = function() {

    // null if no moves

    if ( this.playedMoves == null || this.playedMoves.length == 0 )
        return null;

    // get move

    var m = this.playedMoves[ this.playedMoves.length-1 ];

    // move type

    var move = { MoveType:this.MoveType(m) == MorrisEngine.MOVE_INSERT ? "Insert" : "SlideOrFly" };

    // from square if not an insert

    if ( this.MoveType(m) != MorrisEngine.MOVE_INSERT )
        move.FromSquare = { row:this.FromRow(m), column:this.FromCol(m) };

    // to square always present

    move.ToSquare = { row:this.ToRow(m), column:this.ToCol(m) };

    // capture flag and capture square if required

    move.IsCapture = this.IsCapture(m);

    if ( this.IsCapture(m) == true)
        move.CaptureSquare = { row:this.CaptureRow(m), column:this.CaptureCol(m) };

    // since this describes the last move White is true if it is now blacks turn to move

    move.White = this.side == MorrisEngine.BLACK;

    return move;
}

//
// Return the number of repetitions of the current position. During the negascout search we DON'T update the move
// history or check for repetitions ( since it is slow for long games ) so we only check after moves are played
// by the CPU or human we terminates games when they reach drawn positions.
//
MorrisEngine.prototype.Repetitions = function()
{
    var count = 0;

    for (var i = 0; i < this.nextPositionHistory; i++)
        if (this.positionHistory[i] == this.gameHash)
            count++;

    return count;
}

// 
// Indicate the state of the game
//
MorrisEngine.prototype.EngineState = function()
{
    // if less than two pieces then game over

    if (this.pieceTotals[MorrisEngine.WHITE] + this.inHand[MorrisEngine.WHITE] < 3)
        return MorrisEngine.BLACK_WIN;

    if (this.pieceTotals[MorrisEngine.BLACK] + this.inHand[MorrisEngine.BLACK] < 3)
        return MorrisEngine.WHITE_WIN;

    // if side to move has no legal moves then they loose

    var moveCount = this.GetLegalMoves();

    if (moveCount == 0)
    {
        if (this.side == MorrisEngine.WHITE)
            return MorrisEngine.BLACK_WIN;

        if (this.side == MorrisEngine.BLACK)
            return MorrisEngine.WHITE_WIN;
    }

    // check for draw by repetition

    if (this.Repetitions() >= 3)
        return MorrisEngine.DRAW;

    // return the side to move

    return this.side == MorrisEngine.BLACK ? MorrisEngine.BLACK_MOVE : MorrisEngine.WHITE_MOVE;

}



//
// Add a single square to the board
//
MorrisEngine.prototype.AddSquare = function(index, n)
{
    this.squares[this.squaresIndex] = new Square(index, n, this.squaresIndex);

    this.squaresIndex++;
}

MorrisEngine.prototype

//
// all playable squares on the board
//
MorrisEngine.prototype.squares;

// used when adding new squares to the board

MorrisEngine.prototype.squaresIndex;

//
// Add connection for a single square with 2 connections
//
MorrisEngine.prototype.AddTriple = function( s1, s2,s3)
{
    // connect 3 squares to make a line s1<-->s2<-->s3

    this.AddDouble(s1, s2);

    this.AddDouble(s2, s3);

    // add a triple to the list

    this.triples[this.tripleIndex] = new Triple( this.GetSquare(s1), this.GetSquare(s2), this.GetSquare(s3));

    // insert references to the triple into all the squares it is composed of

    this.GetSquare(s1).ReferenceTriple(this.triples[this.tripleIndex]);

    this.GetSquare(s2).ReferenceTriple(this.triples[this.tripleIndex]);

    this.GetSquare(s3).ReferenceTriple(this.triples[this.tripleIndex]);

    // update the lineTotals

    this.lineTotals[this.triples[this.tripleIndex].lineTotalIndex]++;

    // bump triple index ready for next line

    this.tripleIndex++;
}

//
// Add a bi directional connection between s1 and s2
//
MorrisEngine.prototype.AddDouble = function(s1, s2)
{
    this.GetSquare(s1).ReferenceSquare(this.GetSquare(s2));
}

//
// Used during the setup of various data structures. NOT to be used in move search since it is slow
//
MorrisEngine.prototype.GetSquare = function(index)
{
    var i;

    for( i = 0 ; i < this.squares.length ; i++ ){

        var s = this.squares[i];

        if (s.vindex == index)
            return s;
    }

    throw new Error("Invalid Index");
}

//
// get a logical 7x7 representation of the current board. Used by the UI etc
//
MorrisEngine.prototype.GetBoard = function() {

    // create empty board

    var b = [];

    for( var i = 0 ; i < MorrisEngine.ROWS * MorrisEngine.COLS ; i++ )
        b[i] = MorrisEngine.EMPTY;

    // apply any pieces

    for( i = 0 ; i < this.squares.length ; i++ )
    {
        var s = this.squares[i];

        if (s.piece != MorrisEngine.EMPTY ) {

            var row = s.vindex >> 4;

            var col = s.vindex & 0x0F;

            b[ row * MorrisEngine.COLS + col ] = s.piece;
        }
    }

    return b;
}

//
// return pieces in hand for both sides
//
MorrisEngine.prototype.GetHand = function() {

    return {White:this.inHand[MorrisEngine.WHITE],Black:this.inHand[MorrisEngine.BLACK]};

}

//
// return pieces on the board for both sides
//
MorrisEngine.prototype.GetPieceTotals = function() {

    return {White:this.pieceTotals[MorrisEngine.WHITE],Black:this.pieceTotals[MorrisEngine.BLACK]};

}

//
// play any user move. For inserts fromRow/Col are -1. For other moves there is always a from and to square
// specified. The capture square is always optional and is -1,-1 for non capture moves
//
MorrisEngine.prototype.PlayUserMove = function( fromRow, fromCol, toRow, toCol, captureRow, captureCol ) {

    if ( fromRow < 0 || fromCol < 0 )
        this.AddToHistory( this.PlayUserInsert( toRow, toCol, captureRow, captureCol ) );
    else
        this.AddToHistory( this.PlayUserSlideOrFly( fromRow, fromCol, toRow, toCol, captureRow, captureCol ) );

}

//
// play the given user slide or fly with optional capture
//
MorrisEngine.prototype.PlayUserSlideOrFly = function( fromRow, fromCol, toRow, toCol, captureRow, captureCol ) {

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // search for non insert moves

        var m = this.legalMoves[i];

        // ignore inserts

        if (this.MoveType(m) != MorrisEngine.MOVE_INSERT) {

            if ( this.FromRow(m) == fromRow && this.FromCol(m) == fromCol ) {

                if ( this.ToRow(m) == toRow && this.ToCol(m) == toCol ) {

                    // if not looking for a capture and move is not a capture then we are good

                    if ( captureRow >= 0 ) {

                        if ( this.IsCapture(m) == true ) {

                            // if a complete match then play move and we are done

                            if ( this.CaptureRow(m) == captureRow && this.CaptureCol(m) == captureCol ) {

                                this.PlayMove(m);

                                return m;
                            }
                        }
                    }
                    else
                    {
                        // if move being consider is not a capture then we have a match

                        if ( this.IsCapture(m) == false )
                        {
                            this.PlayMove(m);

                            return m;
                        }
                    }
                }
            }
        }
    }

    // if here no move matching the inputs was found

    throw new Error("No move like that found");
}

//
// play the given user insert at the given location
//
MorrisEngine.prototype.PlayUserInsert = function( row,col,captureRow,captureCol ) {

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // search for insert moves

        var m = this.legalMoves[i];

        if (this.MoveType(m) == MorrisEngine.MOVE_INSERT)
        {
            if ( this.ToRow(m) == row && this.ToCol(m) == col ) {

                // if a capture was specified then that must match also

                if ( captureRow >= 0  ) {

                    if ( this.IsCapture(m) == true ) {

                        if ( this.CaptureRow(m) == captureRow && this.CaptureCol(m) == captureCol ) {

                            this.PlayMove(m);

                            return m;
                        }
                    }
                }
                else
                {
                    if ( this.IsCapture(m) == false ) {

                        // we have a match play the move

                        this.PlayMove(m);

                        return m;
                    }
                }
            }
        }
    }

    // if here no move matching the inputs was found

    throw new Error("No move like that found");
}
//
// Get all valid locations for inserts for the side to move in row/column pairs. This is for use
// by the UI and is too slow for engine use.
//
MorrisEngine.prototype.GetInsertLocations = function()
{
    // results list

    var inserts = [];

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // search for insert moves

        var m = this.legalMoves[i];

        if (this.MoveType(m) == MorrisEngine.MOVE_INSERT)
        {
            // get index of square we are playing into

            var index = this.ToSquare(m);

            // get square

            var s = this.squares[index];

            // add row/column to list

            var row = ( s.vindex >> 4 ) & 0x0F;

            var col = s.vindex & 0x0F;

            inserts.push(row);

            inserts.push(col);
        }
    }

    // return results

    return inserts;
}

//
// Get locations of pieces that can be moved. This works ONLY for slides and fly moves
// since insert moves don't have an origin
//

MorrisEngine.prototype.GetMoveOrigins = function()
{
    // results list

    var origins = [];

    // used to ensure we don't insert duplicates

    var indexList = [];

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // get move

        var m = this.legalMoves[i];

        // check for inserts / slides or fly moves that capture

        if (this.MoveType(m) == MorrisEngine.MOVE_SLIDE || this.MoveType(m) == MorrisEngine.MOVE_FLY)
        {
            // get row/col of destination location to ensure it matches the supplied location

            var index = this.FromSquare(m);

            // get square

            var s = this.squares[index];

            // and capture the same piece )

            if (indexList.indexOf(s.vindex) < 0)
            {
                indexList.push(s.vindex);

                var row = (s.vindex >> 4) & 0x0F;

                var col = s.vindex & 0x0F;

                origins.push(row);

                origins.push(col);
            }
        }
    }

    // return list of valid captures

    return origins;
}

//
// Get all legal destinations for a piece moved from the given location.
// This works for slides and flys
//
MorrisEngine.prototype.GetMoveDestinations = function(row, col) {

    // results list

    var destinations = [];

    // used to check for duplicates ( since capture moves are different according to which piece is captured )

    var indexList = [];

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // get move

        var m = this.legalMoves[i];

        // check only slides and flys...

        if (this.MoveType(m) == MorrisEngine.MOVE_SLIDE || this.MoveType(m) == MorrisEngine.MOVE_FLY )
        {
            // get row/col of destination location to ensure it matches the supplied location

            var index = this.FromSquare(m);

            // get square

            var s = this.squares[index];

            // add row/column to list

            var fromRow = (s.vindex >> 4) & 0x0F;

            var fromCol = s.vindex & 0x0F;

            // match ?

            if (row == fromRow && col == fromCol)
            {
                // get destination square

                index = this.ToSquare(m);

                // ensure we don't already have this location

                if (indexList.indexOf(index) < 0)
                {
                    // so we don't add again..

                    indexList.push(index);

                    // get square

                    s = this.squares[index];

                    // add row/column to list

                    var drow = (s.vindex >> 4) & 0x0F;

                    var dcol = s.vindex & 0x0F;

                    destinations.push(drow);

                    destinations.push(dcol);
                }

            }
        }
    }

    // return list of valid destinations

    return destinations;
}

//
// Get the row/column of all legal captures for a piece played into the given row / column
// This works for inserts ONLY
//
MorrisEngine.prototype.GetCaptureLocationsSlideOrFly = function( fromRow, fromCol, toRow, toCol )
{
    // results list

    var captures = [];

    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // get move

        var m = this.legalMoves[i];

        // check for inserts / slides or fly moves that capture

        if (( this.MoveType(m) == MorrisEngine.MOVE_SLIDE || this.MoveType(m) == MorrisEngine.MOVE_FLY ) && this.IsCapture(m) == true )
        {
            if ( this.FromRow(m) == fromRow &&
                 this.FromCol(m) == fromCol &&
                 this.ToRow(m) == toRow &&
                 this.ToCol(m) == toCol ) {

                // get index of capture square

                var index = this.CaptureSquare(m);

                // get square

                var s = this.squares[index];

                // put capture location into results

                var crow = (s.vindex >> 4) & 0x0F;

                var ccol = s.vindex & 0x0F;

                captures.push(crow);

                captures.push(ccol);
            }
        }
    }

    // return list of valid captures

    return captures;
}

//
// Get the row/column of all legal captures for a piece played into the given row / column
// This works for inserts ONLY
//
MorrisEngine.prototype.GetCaptureLocationsInsert = function( row, col)
{
    // results list

    var captures = [];


    // first generate legal moves

    var count = this.GenerateLegalMoves(0);

    for (var i = 0; i < count; i++)
    {
        // get move

        var m = this.legalMoves[i];

        // check for inserts / slides or fly moves that capture

        if ( this.MoveType(m) == MorrisEngine.MOVE_INSERT && this.IsCapture(m) == true && this.ToRow(m) == row && this.ToCol(m) == col )
        {

            // get index of capture square

            index = this.CaptureSquare(m);

            // get square

            s = this.squares[index];

            // put row/col into results

            var crow = (s.vindex >> 4) & 0x0F;

            var ccol = s.vindex & 0x0F;

            captures.push(crow);

            captures.push(ccol);

        }
    }

    // return list of valid captures

    return captures;
}


// used for tracking insertion point for triples

MorrisEngine.prototype.tripleIndex;

// Line totals for any combination of LIGHT/DARK/EMPTY. The index is formed by combining ( for any given line )
// the ( LIGHT total << 4 ) | ( DARK total << 2 ) | EMPTY total.
// Since the max total can be 3 for any color we will need ( 3 << 4 ) sized array

MorrisEngine.prototype.lineTotals;


//
// Index of all the pieces currently on the board. Each entry is either -1 or the index of piece.
// The first 9 entries are the possible LIGHT pieces and the second 9 are the DARK pieces
//
MorrisEngine.prototype.pieces;

//
// For each color, the number of pieces in hand i.e. waiting to be played on the board ( EXCLUDES captured pieces )
//
MorrisEngine.prototype.inHand;

//
// Transposition table, one for each side
//
MorrisEngine.prototype.TT;


//
// Hash of current game position
//
MorrisEngine.prototype.gameHash;

//
// hash values for every piece in every location
//

//
// hash values for pieces in hand
//
MorrisEngine.prototype.handHash;

// hash values for each piece type on each square

MorrisEngine.prototype.hash_piece;


// Ideally ( and in the my original engine the Zobrist hash as a ulong i.e. unsigned 64 bit key ).
// Since Javascript does not have support for this type and using a library to fake the functionality
// performs badly ( i.e. google.Integer ) I have reduced the key size to 31 bit integers. Since
// JS converts the operands of bitwise operations to 32 bit signed numbers by using signed 31 bit numbers
// we should avoid performance issues and sign extension to negative territory.
// The down side is that now key collisions are much more common but since the engine performs at a fraction
// of the speed of a compiled language this hopefully won't have too much impact.

MorrisEngine.prototype.Hash_Random = function() {

    return this.rand();
}

// Should be identical to the crt function rand i.e. a random number 0->32767 inclusive

MorrisEngine.prototype.rand = function() {

    var limit = ( 1 << 31 ) >>> 0;

    return ( Math.random() * limit ) >>> 0;
}

/// <summary>
/// Initialize hash tables by calculating a random value for each piece ( WHITE/BLACK/SERF/KING ) on each square.
/// Create the transposition table as well.
/// </summary>
MorrisEngine.prototype.SeedHashAndTT = function()
{
    if (this.hash_piece == null)
    {
        // hash piece contains an entry for each color and each square ( and even impossible values )

        var hashLimit = Math.max( Math.max( MorrisEngine.WHITE,MorrisEngine.BLACK ), MorrisEngine.EMPTY );

        this.hash_piece = new Array(hashLimit + 1);

        var i, k,color;

        for( i = 0 ; i < this.hash_piece.length ; i++ )
        {
            this.hash_piece[i] = new Array( this.squares.length + 1 );
        }

        for (i = 0; i <= hashLimit; ++i)
            for (k = 0; k <= this.squares.length; ++k)
                this.hash_piece[i][k] = this.Hash_Random();

        // create TT, initial each entry is assigned a depth of -1 which means empty

        this.TT = new Array(2);

        this.TT[0] = new Array(MorrisEngine.TT_SIZE);

        this.TT[1] = new Array(MorrisEngine.TT_SIZE);

        for (color = MorrisEngine.WHITE; color <= MorrisEngine.BLACK; color++)
        {
            for ( i = 0; i < MorrisEngine.TT_SIZE; i++)
            {
                this.TT[color][i] = new HashEntry();
            }
        }

        // setup the handHash table, which has hash values for each color and possible number of pieces in hand

        this.handHash = new Array(2);

        this.handHash[0] = new Array(10);

        this.handHash[1] = new Array(10);

        for ( color = MorrisEngine.WHITE; color <= MorrisEngine.BLACK; color++)
            for (var hand = 0; hand <= 9; hand++)
            {
                this.handHash[color][hand] = this.Hash_Random();
            }
    }
    else
    {
        // just reset the TT table

        for (color = MorrisEngine.WHITE; color <= MorrisEngine.BLACK; color++)
            for (i = 0; i < MorrisEngine.TT_SIZE; i++)
            {
                this.TT[color][i].height = -1;
            }


    }

    // set initial game hash

    this.gameHash = this.StaticHash();
}

//
// Play the given move.
//
// Move Format:
// -------------
//
// There are three types of move: INSERT (0x00), SLIDE (0x01), FLY (0x02 )
//
// At any given time in the game only one type of move is valid for the side to move.
//
// There are only 24 valid squares on the board, therefore only you need to 5 bits as an index into this.squares to represent a location.
//
// You need only 1 bit to represent the side that played the move
//
// Move format for the various types:
// ----------------------------------
//
// INSERT:
// -------
// A-A-A-A-A-A-A-A   B-B-B-B-B-B-B-B  C-C-C-C-C-C-C-C  D-D-D-D-D-E-F-F
//
// F   == move type [ MOVE_INSERT etc ]
// E   == capture flag
// D   == unused
// C   == from / insert square
// B   == to square for slides / fly
// A   == board index of captured piece for any move type
//
//
MorrisEngine.prototype.PlayMove = function(m)
{

    // different methods for different moves

    if (this.MoveType(m) == MorrisEngine.MOVE_INSERT)
        this.PlayInsert(m);
    else
        this.PlaySlideOrFly(m);

    // switch sides

    this.otherSide = this.side;

    this.side ^= 1;
}

//
// Play the given insert move
//
MorrisEngine.prototype.PlayInsert = function( m )
{
    // get index of square we are playing into

    var index = this.ToSquare(m);

    // get square

    var s = this.squares[index];

    // we are adding a piece to the board so add to the pieces array
    // first we need to find the first available slot in the pieces array

    var pieceIndex = this.side * 9;

    while (this.pieces[pieceIndex] >= 0)
        pieceIndex++;

    this.pieces[pieceIndex] = index;

    s.pieceIndex = pieceIndex;

    // add new piece

    this.pieceTotals[this.side]++;

    // decrement the line count for the current type of lines this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]--;

    this.lineTotals[s.triples[1].lineTotalIndex]--;

    // update triples

    s.triples[0].UpdateSquare(MorrisEngine.EMPTY, this.side);

    s.triples[1].UpdateSquare(MorrisEngine.EMPTY, this.side);

    // increment the line totals for the lines that this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]++;

    this.lineTotals[s.triples[1].lineTotalIndex]++;

    // update the square itself

    s.piece = this.side;

    // remove old number of inHand pieces from game hash

    this.gameHash ^= this.handHash[this.side][this.inHand[this.side]];

    // decrement pieces in hand for the current side

    this.inHand[this.side]--;

    // insert new number of in hand pieces into game hash

    this.gameHash ^= this.handHash[this.side][this.inHand[this.side]];

    // insert new piece into game hash

    this.gameHash ^= this.hash_piece[this.side][index];

    // if the move is a capture then remove the captured piece as well

    if (this.IsCapture(m) == true)
    {
        // play capture

        this.PlayCapture( this.CaptureSquare(m) );
    }
}

//
// Play the given slide to fly
//
MorrisEngine.prototype.PlaySlideOrFly = function( m )
{
    // get from and to squares

    var from = this.FromSquare(m);

    var to = this.ToSquare(m);

    // remove piece and insert at new location in game hash

    this.gameHash ^= this.hash_piece[this.side][from];

    this.gameHash ^= this.hash_piece[this.side][to];

    // get from / to square

    var fromSquare = this.squares[from];

    var toSquare = this.squares[to];

    // update triples for the from and to squares

    this.lineTotals[fromSquare.triples[0].lineTotalIndex]--;

    this.lineTotals[fromSquare.triples[1].lineTotalIndex]--;

    fromSquare.triples[0].UpdateSquare(fromSquare.piece, MorrisEngine.EMPTY);

    fromSquare.triples[1].UpdateSquare(fromSquare.piece, MorrisEngine.EMPTY);

    this.lineTotals[fromSquare.triples[0].lineTotalIndex]++;

    this.lineTotals[fromSquare.triples[1].lineTotalIndex]++;


    this.lineTotals[toSquare.triples[0].lineTotalIndex]--;

    this.lineTotals[toSquare.triples[1].lineTotalIndex]--;

    toSquare.triples[0].UpdateSquare(MorrisEngine.EMPTY, this.side);

    toSquare.triples[1].UpdateSquare(MorrisEngine.EMPTY, this.side);

    this.lineTotals[toSquare.triples[0].lineTotalIndex]++;

    this.lineTotals[toSquare.triples[1].lineTotalIndex]++;

    // update piece index of squares and in pieces array

    toSquare.pieceIndex = fromSquare.pieceIndex;

    this.pieces[toSquare.pieceIndex] = toSquare.squareIndex;

    // set piece value in to square

    toSquare.piece = fromSquare.piece;

    // remove piece from the 'from' square.

    fromSquare.pieceIndex = -1;

    fromSquare.piece = MorrisEngine.EMPTY;

    // if the move is a capture then remove the captured piece as well

    if (this.IsCapture(m) == true)
    {
        // play capture

        this.PlayCapture(this.CaptureSquare(m));
    }
}

//
// Capture the piece at the given index. Assumes the capture is legal and you are captire this.otherSide
//
MorrisEngine.prototype.PlayCapture = function(index)
{
    // get square

    var s = this.squares[index];

    // remove piece from game hash

    this.gameHash ^= this.hash_piece[this.otherSide][index];

    // remove piece from piece array

    this.pieces[s.pieceIndex] = -1;

    s.pieceIndex = -1;

    // remove from piece total

    this.pieceTotals[this.otherSide]--;

    // decrement the line count for the current type of lines this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]--;

    this.lineTotals[s.triples[1].lineTotalIndex]--;

    // update triples

    s.triples[0].UpdateSquare(s.piece, MorrisEngine.EMPTY);

    s.triples[1].UpdateSquare(s.piece, MorrisEngine.EMPTY);

    // increment the line totals for the lines that this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]++;

    this.lineTotals[s.triples[1].lineTotalIndex]++;

    // update the square itself

    s.piece = MorrisEngine.EMPTY;

}

// <summary>
// Un-Play the move, insert, slide, fly all with or without captures
//
MorrisEngine.prototype.UnPlayMove = function(m)
{
    var from, to, s, fromSquare, toSquare;

    // switch sides NOTE: this means the this.side is the side that played the move we are un-playing

    this.otherSide = this.side;

    this.side ^= 1;

    // handle INSERT and other moves differently

    if (this.MoveType(m) == MorrisEngine.MOVE_INSERT)
    {

        // clear the from square

        to = this.ToSquare(m);

        s = this.squares[to];

        s.piece = MorrisEngine.EMPTY;

        // remove from hash

        this.gameHash ^= this.hash_piece[this.side][to];

        // decrement the line count for the current type of lines this square is part of

        this.lineTotals[s.triples[0].lineTotalIndex]--;

        this.lineTotals[s.triples[1].lineTotalIndex]--;

        // update triples

        s.triples[0].UpdateSquare(this.side, MorrisEngine.EMPTY);

        s.triples[1].UpdateSquare(this.side, MorrisEngine.EMPTY);

        // increment the line totals for the lines that this square is part of

        this.lineTotals[s.triples[0].lineTotalIndex]++;

        this.lineTotals[s.triples[1].lineTotalIndex]++;

        // remove from pieces array

        this.pieces[s.pieceIndex] = -1;

        s.pieceIndex = -1;

        // decrement piece totals

        this.pieceTotals[this.side]--;

        // remove old number of inHand pieces from game hash

        this.gameHash ^= this.handHash[this.side][this.inHand[this.side]];

        // increment pieces in hand for the current side

        this.inHand[this.side]++;

        // insert new number of in hand pieces into game hash

        this.gameHash ^= this.handHash[this.side][this.inHand[this.side]];

        // unplay capture if there was one

        if (this.IsCapture(m) == true)
            this.UnPlayCapture(m);
    }
    else
    {
        // unplay a SLIDE or FLY, capture or non capture

        // get from and to squares

        from = this.FromSquare(m);

        to = this.ToSquare(m);

        // remove piece and insert at old location in game hash

        this.gameHash ^= this.hash_piece[this.side][to];

        this.gameHash ^= this.hash_piece[this.side][from];

        // get from / to square

        fromSquare = this.squares[from];

        toSquare = this.squares[to];

        // from square becomes the side to move

        this.lineTotals[fromSquare.triples[0].lineTotalIndex]--;

        this.lineTotals[fromSquare.triples[1].lineTotalIndex]--;

        fromSquare.triples[0].UpdateSquare( MorrisEngine.EMPTY, this.side);

        fromSquare.triples[1].UpdateSquare( MorrisEngine.EMPTY, this.side);

        this.lineTotals[fromSquare.triples[0].lineTotalIndex]++;

        this.lineTotals[fromSquare.triples[1].lineTotalIndex]++;

        // to square becomes empty

        this.lineTotals[toSquare.triples[0].lineTotalIndex]--;

        this.lineTotals[toSquare.triples[1].lineTotalIndex]--;

        toSquare.triples[0].UpdateSquare(this.side, MorrisEngine.EMPTY);

        toSquare.triples[1].UpdateSquare(this.side, MorrisEngine.EMPTY);

        this.lineTotals[toSquare.triples[0].lineTotalIndex]++;

        this.lineTotals[toSquare.triples[1].lineTotalIndex]++;

        // update piece index of squares and in pieces array

        fromSquare.pieceIndex = toSquare.pieceIndex;

        this.pieces[fromSquare.pieceIndex] = fromSquare.squareIndex;

        // from square becomes side to move

        fromSquare.piece = this.side;

        // remove piece from the 'to' square.

        toSquare.pieceIndex = -1;

        toSquare.piece = MorrisEngine.EMPTY;

        // if the move is a capture then remove the captured piece as well

        if (this.IsCapture(m) == true)
        {
            // play capture

            this.UnPlayCapture(m);
        }
    }
}

//
// Unplay the capture ( INSERT, SLIDE or FLY ) in m
//
MorrisEngine.prototype.UnPlayCapture = function(m)
{
    var s, index, pieceIndex;

    // get index of square were the capture occured

    index = this.CaptureSquare(m);

    // get square

    s = this.squares[index];

    // find a vacant slot in this.pieces to put the un-captured piece

    pieceIndex = this.otherSide * 9;

    while (this.pieces[pieceIndex] >= 0)
        pieceIndex++;

    this.pieces[pieceIndex] = index;

    s.pieceIndex = pieceIndex;

    // add new piece for other side

    this.pieceTotals[this.otherSide]++;

    // decrement the line count for the current type of lines this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]--;

    this.lineTotals[s.triples[1].lineTotalIndex]--;

    // update triples

    s.triples[0].UpdateSquare(MorrisEngine.EMPTY, this.otherSide);

    s.triples[1].UpdateSquare(MorrisEngine.EMPTY, this.otherSide);

    // increment the line totals for the lines that this square is part of

    this.lineTotals[s.triples[0].lineTotalIndex]++;

    this.lineTotals[s.triples[1].lineTotalIndex]++;

    // update the square itself

    s.piece = this.otherSide;

    // insert piece back into game hash

    this.gameHash ^= this.hash_piece[this.otherSide][index];
}


// Helper functions for bit packed moves

MorrisEngine.prototype.MoveType = function(m)
{
    return m & MorrisEngine.MOVE_TYPE_MASK;
}

MorrisEngine.prototype.IsCapture = function(m)
{
    return (m & MorrisEngine.MOVE_CAPTURE_FLAG) != 0;
}

MorrisEngine.prototype.FromSquare = function( m)
{
    return (m >> 8) & 0xFF;
}

MorrisEngine.prototype.ToSquare = function(m)
{
    return (m >> 16) & 0xFF;
}

MorrisEngine.prototype.CaptureSquare = function(m)
{
    return (m >> 24);
}

MorrisEngine.prototype.FromRow = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.FromSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return (s.vindex >> 4) & 0x0F;
}

MorrisEngine.prototype.FromCol = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.FromSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return s.vindex & 0x0F;
}

MorrisEngine.prototype.ToRow = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.ToSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return (s.vindex >> 4) & 0x0F;
}

MorrisEngine.prototype.ToCol = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.ToSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return s.vindex & 0x0F;
}

MorrisEngine.prototype.CaptureRow = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.CaptureSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return (s.vindex >> 4) & 0x0F;
}

MorrisEngine.prototype.CaptureCol = function(m) {

    // get row/col of destination location to ensure it matches the supplied location

    var index = this.CaptureSquare(m);

    // get square

    var s = this.squares[index];

    // add row/column to list

    return s.vindex & 0x0F;
}

//
// Calculate a complete hash value for the current board position. Use only at the start of a game
// . During a game the hash value is dynamically updated
//
MorrisEngine.prototype.StaticHash = function()
{
    // first XOR in the number of pieces in hand for each color

    var hash = this.handHash[MorrisEngine.WHITE][this.inHand[MorrisEngine.WHITE]];

    hash ^= this.handHash[MorrisEngine.BLACK][ this.inHand[MorrisEngine.BLACK]];

    // XOR in hash value for each piece on each square

    for (var i = 0; i < this.squares.length; i++)
    {
        var s = this.squares[i];

        if (s.piece != MorrisEngine.EMPTY)
        {
            hash ^= this.hash_piece[s.piece][s.squareIndex];
        }
    }

    return hash;
}

/// <summary>
/// Lower the height of all used T.T. entries so that older entires gracefully age out eventually
/// </summary>
MorrisEngine.prototype.AgeTT = function()
{
    var c,i;

    for (c = MorrisEngine.WHITE; c <= MorrisEngine.BLACK; c++)
        for (i = 0; i < MorrisEngine.TT_SIZE; i++)

            if (this.TT[c][i].height > -1)
                this.TT[c][i].height--;
}

//
// The history table. This is a kind of hash table using from and to squares of the move as the index.
// INSERT moves have a from square that is OFF_BOARD ( 0x70 ) so the table is dimensioned 0x80,0x80 to ensure it is sized correctly.
// Moves that become, even temporarily best during the search get a boosted value in the history table. Then during move
// sorting moves with higher history values float to the top of the legal move table.
//
MorrisEngine.prototype.history;

// required dimension of the two axis of the history table

MorrisEngine.HISTORY_DIM = 0x80;

//
// class static constants
//

// engine state

MorrisEngine.WHITE_WIN = 0;

MorrisEngine.BLACK_WIN = 1;

MorrisEngine.WHITE_MOVE = 2;

MorrisEngine.BLACK_MOVE = 3;

MorrisEngine.DRAW = 4;

//
// Rows and columns in game.
//
MorrisEngine.ROWS = 7;

MorrisEngine.COLS = 7;

// piece color value

MorrisEngine.WHITE = 0x00;

MorrisEngine.BLACK = 0x01;

MorrisEngine.EMPTY = 0x02;

// maximum depth of search allowed

MorrisEngine.MAX_DEPTH = 40;

// Max number of legal moves at any given depth

MorrisEngine.MAX_MOVES = 3 * 24 * 9;

// # entries in the transposition table

MorrisEngine.TT_SIZE = 10000;

// <summary>
// Types of scores in TT

MorrisEngine.TT_EXACT = 0;

MorrisEngine.TT_UPPER = 1;

MorrisEngine.TT_LOWER = 2;

// move generator constants used as bit flags in legal move lists

//
// Moves types, encoded in bits 0,1 of a move

MorrisEngine.MOVE_INSERT = 0x00;

MorrisEngine.MOVE_SLIDE = 0x01;

MorrisEngine.MOVE_FLY = 0x02;

// The capture flag in a bit pack move

MorrisEngine.MOVE_CAPTURE_FLAG = 0x04;

// gets the move type from a bit packed move

MorrisEngine.MOVE_TYPE_MASK = 0x03;

// When used to indicate a square index ( from squares for INSERT moves ) this indicates the from square was actually off the board i.e. in hand )

MorrisEngine.OFF_BOARD = 0x70;

//
// returns from the Score / Negascount methods
//
// Wins get a special value, higher ( or lower! ) than any other score.
// This enables searches to be terminated when win position are reached versus merely good position.
//
MorrisEngine.WIN = 100000;

//
// Win scores are +/- the search ply so anything close to a win (+/-) are a win
//
MorrisEngine.WIN_APPROXIMATION = 90000;

//
// Constants that provide the indexes into lineTotals for lines containing important values i.e. a triple containing only 1 disk of 1 color etc
//
MorrisEngine.WHITE_LINE_1 = (1 << 8) | (0 << 4) | 2;

MorrisEngine.WHITE_LINE_2 = (2 << 8) | (0 << 4) | 1;

MorrisEngine.WHITE_LINE_3 = (3 << 8) | (0 << 4) | 0;


MorrisEngine.BLACK_LINE_1 = (0 << 8) | (1 << 4) | 2;

MorrisEngine.BLACK_LINE_2 = (0 << 8) | (2 << 4) | 1;

MorrisEngine.BLACK_LINE_3 = (0 << 8) | (3 << 4) | 0;

//
// captures moves are scored with at least this value to ensure they are higher than other moves in the history table
//
MorrisEngine.MOVE_CAPTURE_SCORE = 10000000;

//
// Used to indicate no move
//
MorrisEngine.NULL_MOVE = -1;