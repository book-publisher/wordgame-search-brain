const INCH_TO_PT = 72;

function parseTrimSize(trimSizeStr) {
    let widthIn, heightIn;
    if (trimSizeStr === '8.5x11') { widthIn = 8.5; heightIn = 11; }
    else if (trimSizeStr === '6x9') { widthIn = 6; heightIn = 9; }
    else if (trimSizeStr === '8.5x8.5') { widthIn = 8.5; heightIn = 8.5; }
    else if (trimSizeStr === 'A4') { widthIn = 8.27; heightIn = 11.69; }
    else { widthIn = 8.5; heightIn = 11; }
    return { widthIn, heightIn };
}

function drawTitle(pdf, title, puzzleNum, pageWidthIn, titleFont, titlePlacement, fullTitle) {
    const displayTitle = fullTitle ? `${title} #${puzzleNum}` : `Puzzle ${puzzleNum}`;
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(fullTitle ? 18 : 12);
    pdf.setTextColor(0, 0, 0);
    
    const textWidth = pdf.getTextWidth(displayTitle);
    let x;
    if (titlePlacement === 'left') x = 0.5;
    else if (titlePlacement === 'right') x = pageWidthIn - 0.5 - textWidth;
    else x = (pageWidthIn - textWidth) / 2;
    
    pdf.text(displayTitle, x, 0.8);
}

function drawGrid(pdf, puzzleData, offsetX, offsetY, cellSizePt, isSolution, isSmallMode) {
    const grid = puzzleData.result.grid;
    const rows = grid.length;
    const cols = grid[0].length;
    const placedWords = puzzleData.result.placedWords;
    
    // Build set of highlighted cells for solutions
    const highlightSet = new Set();
    if (isSolution) {
        placedWords.forEach(pw => {
            pw.path.forEach(([r, c]) => highlightSet.add(`${r}-${c}`));
        });
    }
    
    // Grid border
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(isSmallMode ? 0.3 : 0.5);
    pdf.rect(offsetX, offsetY, cols * cellSizePt, rows * cellSizePt);
    
    const fontSize = isSmallMode ? 7 : Math.min(12, cellSizePt * 0.55);
    
    // Draw each cell
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = offsetX + c * cellSizePt;
            const y = offsetY + r * cellSizePt;
            
            // Highlight background for solution placed words
            if (highlightSet.has(`${r}-${c}`)) {
                pdf.setFillColor(74, 144, 226);
                pdf.rect(x, y, cellSizePt, cellSizePt, 'F');
            } else {
                pdf.setFillColor(255, 255, 255);
                pdf.rect(x, y, cellSizePt, cellSizePt, 'F');
            }
            
            // Cell border
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            pdf.rect(x, y, cellSizePt, cellSizePt, 'S');
            
            // Letter
            const letter = grid[r][c];
            pdf.setFont('Courier', 'bold');
            pdf.setFontSize(fontSize);
            
            if (highlightSet.has(`${r}-${c}`)) {
                pdf.setTextColor(255, 255, 255);
            } else {
                pdf.setTextColor(0, 0, 0);
            }
            
            const textWidth = pdf.getTextWidth(letter);
            const textX = x + (cellSizePt - textWidth) / 2;
            const textY = y + cellSizePt * 0.7;
            pdf.text(letter, textX, textY);
        }
    }
}

function drawClues(pdf, placedWords, offsetX, offsetY, pageWidthIn, clueCols, fontClues) {
    const words = placedWords.map(pw => pw.word).sort();
    const fontSize = 9;
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(0, 0, 0);
    
    const colWidth = (pageWidthIn - 1) / clueCols;
    const lineHeight = 0.22;
    const maxRows = Math.ceil(words.length / clueCols);
    
    for (let i = 0; i < words.length; i++) {
        const col = Math.floor(i / maxRows);
        const row = i % maxRows;
        const x = offsetX + col * colWidth;
        const y = offsetY + row * lineHeight;
        pdf.text(words[i], x, y);
    }
    
    return offsetY + maxRows * lineHeight + 0.3;
}

function drawSolutionPageHeader(pdf, pageNum, pageWidthIn) {
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    const header = `Solutions - Page ${pageNum}`;
    const textWidth = pdf.getTextWidth(header);
    pdf.text(header, (pageWidthIn - textWidth) / 2, 0.7);
}

async function generatePDF(puzzlesData, trimSizeStr, solutionsPerPage) {
    const { jsPDF } = window.jspdf;
    const { widthIn, heightIn } = parseTrimSize(trimSizeStr);
    
    const pdf = new jsPDF({
        orientation: widthIn > heightIn ? 'landscape' : 'portrait',
        unit: 'in',
        format: [widthIn, heightIn]
    });
    
    const margin = 0.5;
    const contentWidth = widthIn - margin * 2;
    const contentHeight = heightIn - margin * 2;
    
    // 1. Render all Puzzle Pages
    for (let i = 0; i < puzzlesData.length; i++) {
        if (i > 0) {
            pdf.addPage([widthIn, heightIn], widthIn > heightIn ? 'landscape' : 'portrait');
        }
        
        const data = puzzlesData[i];
        const s = data.settings;
        
        // Title
        drawTitle(pdf, s.title, i + 1, widthIn, s.fontTitle, s.titlePlacement, true);
        
        // Calculate grid cell size to fit available space
        const maxGridWidth = contentWidth;
        const maxGridHeight = contentHeight * 0.55;
        const cellW = Math.floor(Math.min(maxGridWidth / s.cols, maxGridHeight / s.rows));
        
        const gridWidthPt = s.cols * cellW;
        const gridOffsetX = (widthIn - gridWidthPt) / 2;
        const gridOffsetY = 1.2;
        
        // Draw grid
        drawGrid(pdf, data, gridOffsetX, gridOffsetY, cellW, false, false);
        
        // Draw clues below grid
        const clueY = gridOffsetY + s.rows * cellW + 0.4;
        if (clueY < heightIn - 0.5) {
            drawClues(pdf, data.result.placedWords, margin, clueY, widthIn, s.clueCols, s.fontClues);
        }
    }
    
    // 2. Render Solution Pages
    let solIndex = 0;
    let solPageNum = 1;
    
    while (solIndex < puzzlesData.length) {
        pdf.addPage([widthIn, heightIn], widthIn > heightIn ? 'landscape' : 'portrait');
        drawSolutionPageHeader(pdf, solPageNum, widthIn);
        
        const itemsOnThisPage = Math.min(solutionsPerPage, puzzlesData.length - solIndex);
        
        // Calculate layout grid
        let gridCols, gridRows;
        if (itemsOnThisPage <= 2) { gridCols = itemsOnThisPage; gridRows = 1; }
        else if (itemsOnThisPage <= 4) { gridCols = 2; gridRows = 2; }
        else if (itemsOnThisPage <= 6) { gridCols = 3; gridRows = 2; }
        else { gridCols = 4; gridRows = 2; }
        
        const availWidth = contentWidth;
        const availHeight = contentHeight - 0.8;
        const slotW = availWidth / gridCols;
        const slotH = availHeight / gridRows;
        
        for (let j = 0; j < itemsOnThisPage; j++) {
            const col = j % gridCols;
            const row = Math.floor(j / gridCols);
            const data = puzzlesData[solIndex + j];
            const s = data.settings;
            
            // Slot position
            const slotX = margin + col * slotW;
            const slotY = 1.0 + row * slotH;
            
            // Puzzle label
            pdf.setFont('Helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            const label = `Puzzle ${solIndex + j + 1}`;
            const labelWidth = pdf.getTextWidth(label);
            pdf.text(label, slotX + (slotW - labelWidth) / 2, slotY + 0.2);
            
            // Calculate small grid cell size
            const maxCellW = (slotW - 0.2) / s.cols;
            const maxCellH = (slotH - 0.5) / s.rows;
            const smallCell = Math.floor(Math.min(maxCellW, maxCellH));
            
            const smallGridW = s.cols * smallCell;
            const gridX = slotX + (slotW - smallGridW) / 2;
            const gridY = slotY + 0.35;
            
            drawGrid(pdf, data, gridX, gridY, smallCell, true, true);
        }
        
        solIndex += itemsOnThisPage;
        solPageNum++;
    }
    
    pdf.save('WordSearch_PuzzleBook.pdf');
}
