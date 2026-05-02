<?php
/**
 * Simple PDF Generator without external dependencies
 * Uses basic PDF structure
 */

class SimplePDF {
    private $content = '';
    private $pageWidth = 595; // A4 width in points
    private $pageHeight = 842; // A4 height in points
    private $margin = 50;
    private $yPosition = 50;
    private $churchLogo = null;
    
    public function __construct($churchLogo = null) {
        $this->yPosition = $this->margin;
        $this->churchLogo = $churchLogo;
    }
    
    public function addLogo() {
        if ($this->churchLogo && strpos($this->churchLogo, 'data:image') === 0) {
            $this->content .= "<div style='text-align: center; margin-bottom: 20px;'>";
            $this->content .= "<img src='" . $this->churchLogo . "' style='max-width: 120px; max-height: 120px;' />";
            $this->content .= "</div>";
        }
    }
    
    public function addTitle($text, $size = 20) {
        $this->content .= "<h1 style='font-size: {$size}px; text-align: center; margin: 20px 0;'>" . htmlspecialchars($text) . "</h1>";
    }
    
    public function addSubtitle($text, $size = 14) {
        $this->content .= "<h2 style='font-size: {$size}px; text-align: center; color: #666; margin: 10px 0;'>" . htmlspecialchars($text) . "</h2>";
    }
    
    public function addText($text, $align = 'left') {
        $this->content .= "<p style='text-align: {$align}; margin: 10px 0;'>" . htmlspecialchars($text) . "</p>";
    }
    
    public function addTable($headers, $rows) {
        $this->content .= "<table style='width: 100%; border-collapse: collapse; margin: 20px 0;'>";
        
        // Headers
        $this->content .= "<thead><tr style='background: #4F46E5; color: white;'>";
        foreach ($headers as $header) {
            $this->content .= "<th style='padding: 10px; border: 1px solid #ddd; text-align: left;'>" . htmlspecialchars($header) . "</th>";
        }
        $this->content .= "</tr></thead>";
        
        // Rows
        $this->content .= "<tbody>";
        $rowNum = 0;
        foreach ($rows as $row) {
            $bgColor = $rowNum % 2 == 0 ? '#f9f9f9' : 'white';
            $this->content .= "<tr style='background: {$bgColor};'>";
            foreach ($row as $cell) {
                $this->content .= "<td style='padding: 8px; border: 1px solid #ddd;'>" . htmlspecialchars($cell) . "</td>";
            }
            $this->content .= "</tr>";
            $rowNum++;
        }
        $this->content .= "</tbody></table>";
    }
    
    public function addSummaryBox($items) {
        $this->content .= "<div style='background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;'>";
        foreach ($items as $label => $value) {
            $this->content .= "<div style='display: inline-block; margin-right: 30px;'>";
            $this->content .= "<strong>" . htmlspecialchars($label) . ":</strong> " . htmlspecialchars($value);
            $this->content .= "</div>";
        }
        $this->content .= "</div>";
    }
    
    public function output($filename) {
        // Set timezone to Philippines
        date_default_timezone_set('Asia/Manila');
        
        $html = "<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>" . htmlspecialchars($filename) . "</title>
    <style>
        @media print {
            body { 
                margin: 0; 
                padding: 20px;
            }
            @page { 
                margin: 15mm;
                size: A4;
            }
            .print-instructions {
                display: none !important;
            }
        }
        @media screen {
            body { margin: 40px; }
            .print-instructions {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #4F46E5;
                color: white;
                padding: 15px;
                text-align: center;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }
            .print-instructions strong {
                display: block;
                font-size: 16px;
                margin-bottom: 5px;
            }
            .print-instructions small {
                font-size: 13px;
            }
            .content-wrapper {
                margin-top: 100px;
            }
        }
        body { 
            font-family: Arial, sans-serif;
        }
        table { 
            page-break-inside: auto;
            width: 100%;
        }
        tr { 
            page-break-inside: avoid; 
            page-break-after: auto;
        }
        thead { 
            display: table-header-group;
        }
    </style>
</head>
<body>
<div class='print-instructions'>
    <strong>📄 Print Dialog Opening...</strong>
    <small>To remove headers/footers: In print settings, disable 'Headers and footers' option</small>
</div>
<div class='content-wrapper'>
{$this->content}
<div style='text-align: center; margin-top: 30px; font-size: 12px; color: #888;'>
    Generated: " . date('F d, Y g:i A') . "
</div>
</div>
<script>
    // Auto-print when page loads
    window.onload = function() {
        // Small delay to ensure page is fully loaded
        setTimeout(function() {
            window.print();
        }, 500);
    };
    
    // Close window after printing or canceling
    window.onafterprint = function() {
        // Optional: close window after print
        // window.close();
    };
</script>
</body>
</html>";
        
        // Output HTML that will be printed to PDF
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
    }
}
