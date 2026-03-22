<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>

<style>
    /* Common Styles */
    .bg-navy { background-color: #001f3f !important; color: white; }
    
    /* Desktop Export Buttons */
    .export-buttons { display: flex; gap: 8px; margin-left: 10px; }
    .export-btn { padding: 5px 12px; border-radius: 4px; font-size: 14px; display: flex; align-items: center; gap: 5px; transition: all 0.3s; text-decoration: none !important; cursor: pointer; border: none; }
    .export-btn:hover { opacity: 0.9; transform: translateY(-2px); }
    .btn-print { background-color: #6c757d; color: white; }
    .btn-pdf { background-color: #dc3545; color: white; }
    .btn-excel { background-color: #28a745; color: white; }
    
    /* Desktop Table */
    .table-responsive { display: block; }
    
    /* Desktop Table Avatar */
    .table-client-avatar {
        width: 35px;
        height: 35px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid #ddd;
        margin-right: 10px;
    }
    .client-cell { display: flex; align-items: center; }
    
    /* ==================== MOBILE REDESIGN ==================== */
    @media (max-width: 768px) {
        /* Hide desktop elements */
        .table-responsive, 
        .desktop-filter-form,
        #transaction-list,
        .dataTables_wrapper,
        .dataTables_length,
        .dataTables_filter,
        .dataTables_info,
        .dataTables_paginate,
        .desktop-export-buttons {
            display: none !important;
        }
        
        /* Mobile View Container */
        .mobile-view {
            display: block !important;
            position: relative;
            min-height: calc(100vh - 120px);
            background: #f5f7fa;
            padding: 10px !important;
            margin: -10px !important;
        }
        
        /* Mobile Header */
        .mobile-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 15px 20px 15px;
            margin: -10px -10px 10px -10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .mobile-header h4 {
            margin: 0 0 15px 0;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.2rem;
        }
        
        .mobile-header h4 i {
            background: rgba(255,255,255,0.2);
            padding: 8px;
            border-radius: 50%;
        }
        
        /* Quick Stats */
        .mobile-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 0 0 15px 0;
        }
        
        .stat-card {
            background: white;
            border-radius: 10px;
            padding: 12px 8px;
            text-align: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08);
            border-top: 3px solid #667eea;
        }
        
        .stat-card h3 {
            margin: 0;
            font-size: 1.1rem;
            color: #2d3748;
            font-weight: 800;
        }
        
        .stat-card p {
            margin: 5px 0 0;
            font-size: 0.75rem;
            color: #718096;
        }
        
        /* Search Bar */
        .mobile-search-container {
            position: relative;
            margin: 0;
        }
        
        .mobile-search-wrapper {
            position: relative;
        }
        
        .mobile-search-input {
            width: 100%;
            padding: 14px 45px 14px 45px;
            border: none;
            border-radius: 12px;
            font-size: 0.95rem;
            background: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s;
        }
        
        .mobile-search-input:focus {
            outline: none;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.25);
        }
        
        .mobile-search-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: #667eea;
            font-size: 1.1rem;
        }
        
        .mobile-filter-btn {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: #667eea;
            color: white;
            border: none;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
        }
        
        /* Transaction Cards Redesign - FIXED MARGIN ISSUE */
        #transactionCardsContainer {
            padding: 5px 0 100px 0 !important;
            margin: 0;
        }
        
        .mobile-transaction-card {
            background: white;
            border-radius: 14px;
            margin: 0 0 15px 0 !important;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            transition: transform 0.3s, box-shadow 0.3s;
            border-left: 5px solid;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }
        
        /* Status-based border colors */
        .status-border-0 { border-color: #a0aec0; }
        .status-border-1 { border-color: #4299e1; }
        .status-border-2 { border-color: #38b2ac; }
        .status-border-3 { border-color: #48bb78; }
        .status-border-4 { border-color: #f56565; }
        .status-border-5 { border-color: #ed8936; }
        
        .card-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 15px;
            background: linear-gradient(90deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%);
        }
        
        .job-info {
            flex: 1;
            min-width: 0; /* Prevents overflow */
        }
        
        .job-info h3 {
            margin: 0 0 5px;
            font-size: 1.2rem;
            color: #2d3748;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .job-info h3 a {
            color: inherit;
            text-decoration: none;
        }
        
        .job-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 0.8rem;
            color: #718096;
        }
        
        .job-code {
            background: rgba(102,126,234,0.1);
            color: #667eea;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 600;
            white-space: nowrap;
        }
        
        .job-date {
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
        }
        
        .status-badge-mobile {
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
            margin-left: 10px;
        }
        
        .status-0 { background: #a0aec0; color: white; }
        .status-1 { background: #4299e1; color: white; }
        .status-2 { background: #38b2ac; color: white; }
        .status-3 { background: #48bb78; color: white; }
        .status-4 { background: #f56565; color: white; }
        .status-5 { background: #ed8936; color: white; }
        
        /* Client Section - More Compact */
        .card-client {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .client-avatar {
            width: 45px;
            height: 45px;
            border-radius: 10px;
            object-fit: cover;
            border: 2px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
            flex-shrink: 0;
        }
        
        .client-details {
            flex: 1;
            margin-left: 12px;
            min-width: 0; /* Prevents overflow */
        }
        
        .client-name {
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .client-phone {
            color: #48bb78;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 3px;
        }
        
        .client-balance {
            font-size: 0.8rem;
        }
        
        /* More Informative Details Section */
        .card-details {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #e2e8f0;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            color: #718096;
            font-size: 0.85rem;
            font-weight: 500;
            flex-shrink: 0;
            width: 35%;
        }
        
        .detail-value {
            color: #2d3748;
            font-weight: 600;
            text-align: right;
            flex: 1;
            padding-left: 10px;
            word-break: break-word;
        }
        
        .item-model {
            font-size: 1rem;
            font-weight: 700;
            color: #4a5568;
        }
        
        .fault-text {
            color: #e53e3e;
        }
        
        .amount-display {
            font-size: 1.3rem;
            font-weight: 800;
            color: #2d3748;
        }
        
        /* Additional Info Section */
        .card-extra-info {
            padding: 10px 15px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .extra-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 0.85rem;
        }
        
        .extra-label {
            color: #718096;
        }
        
        .extra-value {
            color: #4a5568;
            font-weight: 500;
        }
        
        /* Action Buttons - 6 BUTTONS FIXED LAYOUT */
        .card-actions {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 12px 15px;
            background: #f7fafc;
        }
        
        .action-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 5px;
            background: white;
            border: none;
            border-radius: 10px;
            text-decoration: none;
            color: #4a5568;
            transition: all 0.3s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.06);
            min-height: 60px;
            justify-content: center;
        }
        
        .action-btn i {
            font-size: 1.1rem;
            margin-bottom: 5px;
        }
        
        .action-btn span {
            font-size: 0.7rem;
            font-weight: 600;
            line-height: 1.2;
            text-align: center;
        }
        
        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        
        /* Button Colors */
        .btn-view { 
            color: #4299e1; 
            border-top: 3px solid #4299e1;
        }
        .btn-whatsapp { 
            color: #48bb78; 
            border-top: 3px solid #48bb78;
        }
        .btn-print { 
            color: #ed8936; 
            border-top: 3px solid #ed8936;
        }
        .btn-edit { 
            color: #9f7aea; 
            border-top: 3px solid #9f7aea;
        }
        .btn-old-edit { 
            color: #38b2ac; 
            border-top: 3px solid #38b2ac;
        }
        .btn-delete { 
            color: #f56565; 
            border-top: 3px solid #f56565;
        }
        
        /* Floating Action Button - FIXED POSITION */
        .fab-container {
            position: fixed;
            bottom: 80px; /* Above footer */
            right: 15px;
            z-index: 1050; /* Higher than footer */
        }
        
        .fab-main {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 1.3rem;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .fab-main:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
        }
        
        .fab-menu {
            position: absolute;
            bottom: 65px;
            right: 0;
            background: white;
            border-radius: 12px;
            padding: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            display: none;
            min-width: 160px;
            z-index: 1051;
        }
        
        .fab-menu.active {
            display: block;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .fab-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            text-decoration: none;
            color: #4a5568;
            border-radius: 8px;
            transition: background 0.3s;
            font-size: 0.9rem;
        }
        
        .fab-item:hover {
            background: #f7fafc;
        }
        
        .fab-item i {
            width: 18px;
            text-align: center;
        }
        
        .fab-text {
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        /* Search Results Indicator */
        .results-indicator {
            background: white;
            border-radius: 20px;
            padding: 8px 15px;
            margin: 10px 0 15px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08);
            font-size: 0.85rem;
        }
        
        .results-count {
            color: #667eea;
            font-weight: 800;
            font-size: 1rem;
        }
        
        .clear-search {
            background: none;
            border: none;
            color: #718096;
            font-size: 1.1rem;
            cursor: pointer;
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 50px 20px;
        }
        
        .empty-icon {
            font-size: 3.5rem;
            color: #cbd5e0;
            margin-bottom: 15px;
        }
        
        .empty-state h4 {
            color: #718096;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }
        
        .empty-state p {
            color: #a0aec0;
            font-size: 0.85rem;
        }
        
        /* Filter Modal */
        .filter-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        }
        
        .filter-modal.active {
            display: flex;
        }
        
        .filter-content {
            background: white;
            width: 90%;
            max-width: 380px;
            border-radius: 16px;
            padding: 20px;
            animation: slideUp 0.3s ease;
        }
        
        .filter-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .filter-header h3 {
            margin: 0;
            color: #2d3748;
            font-size: 1.2rem;
        }
        
        .close-filter {
            background: none;
            border: none;
            font-size: 1.3rem;
            color: #718096;
            cursor: pointer;
        }
        
        .filter-body .form-group {
            margin-bottom: 15px;
        }
        
        .filter-body label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            color: #4a5568;
            font-size: 0.9rem;
        }
        
        .filter-body .form-control {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 0.95rem;
            transition: border-color 0.3s;
        }
        
        .filter-body .form-control:focus {
            border-color: #667eea;
            outline: none;
        }
        
        .filter-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .filter-actions button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 0.95rem;
        }
        
        .btn-apply {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-reset {
            background: #e2e8f0;
            color: #4a5568;
        }
        
        /* Date Completed Badge */
        .date-completed {
            font-size: 0.75rem;
            color: #718096;
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        /* Hide Delivered Toggle (Mobile) */
        .mobile-hide-delivered {
            margin-top: 10px;
            background: rgba(255,255,255,0.15);
            padding: 8px 12px;
            border-radius: 20px;
            display: inline-block;
            color: white;
        }
        .mobile-hide-delivered label {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            cursor: pointer;
        }
        .mobile-hide-delivered input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }
    }
    
    /* Desktop Styles */
    @media (min-width: 769px) {
        .mobile-view,
        .mobile-export-buttons,
        .mobile-filter-form {
            display: none !important;
        }
        
        .table-responsive {
            display: block !important;
        }
        
        .desktop-filter-form {
            display: block !important;
        }
        
        .desktop-export-buttons {
            display: flex !important;
            align-items: center;
            gap: 10px;
        }
        
        /* Hide Delivered Toggle (Desktop) */
        .desktop-hide-delivered {
            margin-left: 15px;
            display: inline-flex;
            align-items: center;
            background: #f8f9fa;
            padding: 5px 12px;
            border-radius: 20px;
            border: 1px solid #dee2e6;
        }
        .desktop-hide-delivered label {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            cursor: pointer;
        }
        .desktop-hide-delivered input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
    }
	/* Add these styles to the desktop section */

/* Desktop Table Column Adjustments */
@media (min-width: 769px) {
    .table-responsive {
        display: block !important;
    }
    
    .desktop-filter-form {
        display: block !important;
    }
    
    .desktop-export-buttons {
        display: flex !important;
        align-items: center;
        gap: 10px;
    }
    
    /* Adjusted column widths */
    #transaction-list {
        table-layout: fixed;
    }
    
    #transaction-list colgroup {
        display: table-column-group;
    }
    
    #transaction-list col {
        display: table-column;
    }
    
    /* New column widths */
    #transaction-list col:nth-child(1) { width: 4%; } /* # */
    #transaction-list col:nth-child(2) { width: 9%; } /* Date */
    #transaction-list col:nth-child(3) { width: 10%; } /* Job/Code */
    #transaction-list col:nth-child(4) { width: 25%; } /* Client - INCREASED */
    #transaction-list col:nth-child(5) { width: 12%; } /* Item/Model */
    #transaction-list col:nth-child(6) { width: 10%; } /* Fault */
    #transaction-list col:nth-child(7) { width: 5%; } /* Locate */
    #transaction-list col:nth-child(8) { width: 8%; } /* Amount */
    #transaction-list col:nth-child(9) { width: 8%; } /* Status */
    #transaction-list col:nth-child(10) { width: 9%; } /* Action */
    
    /* Improved client cell display */
    .client-cell {
        display: flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
    }
    
    .client-cell img.table-client-avatar {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        margin-right: 12px;
    }
    
    .client-cell > div {
        min-width: 0;
        flex: 1;
    }
    
    .client-cell .font-weight-bold {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        font-size: 0.95rem;
    }
    
    .client-cell .mt-1 {
        margin-top: 4px !important;
    }
    
    .client-cell small {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
    
    /* Table cell padding adjustments */
    #transaction-list td.py-2,
    #transaction-list td.py-3 {
        padding: 0.6rem 0.5rem;
        vertical-align: middle;
    }
    
    #transaction-list td.align-middle {
        padding: 0.5rem;
    }
    
    /* Make table cells handle overflow better */
    #transaction-list td {
        word-wrap: break-word;
        max-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    /* Specific column adjustments */
    #transaction-list td:nth-child(5), /* Item/Model */
    #transaction-list td:nth-child(6) { /* Fault */
        font-size: 0.9rem;
        line-height: 1.3;
    }
    
    /* Status column */
    #transaction-list td:nth-child(9) {
        font-size: 0.85rem;
    }
    
    /* Amount column */
    #transaction-list td.text-right {
        font-weight: 600;
        font-size: 0.95rem;
    }
    
    /* Action column */
    #transaction-list td:nth-child(10) {
        padding: 0.5rem;
    }
	/* Add these styles to the desktop section */

@media (min-width: 769px) {
    /* Previous desktop styles... */
    
    /* Client cell - LARGER PHOTO, SMALLER TEXT */
    .client-cell {
        display: flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
    }
    
    .client-cell img.table-client-avatar {
        width: 60px; /* Increased from 35px/40px */
        height: 60px; /* Increased from 35px/40px */
        flex-shrink: 0;
        margin-right: 15px;
        object-fit: cover;
        border-radius: 6px; /* Slightly larger radius */
        border: 2px solid #e9ecef; /* Thicker border */
    }
    
    .client-cell > div {
        min-width: 0;
        flex: 1;
    }
    
    /* Client name - SMALLER */
    .client-cell .font-weight-bold {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        font-size: 0.85rem; /* Reduced from 0.95rem */
        font-weight: 700;
        margin-bottom: 2px;
    }
    
    /* Balance badges - SMALLER */
    .client-cell .mt-1 {
        margin-top: 3px !important;
        margin-bottom: 2px !important;
    }
    
    .client-cell .mt-1 .badge {
        font-size: 0.65rem !important; /* Reduced from 0.7rem */
        padding: 2px 6px;
    }
    
    /* WhatsApp link - SMALLER */
    .client-cell small.text-success {
        font-size: 0.75rem; /* Reduced */
    }
    
    .client-cell small.text-success a {
        font-size: 0.75rem;
        text-decoration: none;
    }
    
    .client-cell small.text-success i {
        font-size: 0.7rem;
    }
    
    /* No contact text - SMALLER */
    .client-cell small .text-xs {
        font-size: 0.7rem !important;
    }
    
    /* Adjust column widths to accommodate larger photo */
    #transaction-list col:nth-child(1) { width: 4%; } /* # */
    #transaction-list col:nth-child(2) { width: 9%; } /* Date */
    #transaction-list col:nth-child(3) { width: 10%; } /* Job/Code */
    #transaction-list col:nth-child(4) { width: 26%; } /* Client - Slightly increased */
    #transaction-list col:nth-child(5) { width: 12%; } /* Item/Model */
    #transaction-list col:nth-child(6) { width: 10%; } /* Fault */
    #transaction-list col:nth-child(7) { width: 5%; } /* Locate */
    #transaction-list col:nth-child(8) { width: 8%; } /* Amount */
    #transaction-list col:nth-child(9) { width: 8%; } /* Status */
    #transaction-list col:nth-child(10) { width: 8%; } /* Action */
}
}
</style>

<div class="card card-outline rounded-0 card-navy shadow">
    <div class="card-header">
        <h3 class="card-title"><b><i class="fas fa-exchange-alt text-navy"></i> Transaction History</b></h3>
        <div class="card-tools d-flex align-items-center">
            <!-- Desktop Export Buttons -->
            <div class="desktop-export-buttons">
                <a href="./?page=transactions/manage_transaction" class="btn btn-flat btn-primary btn-sm ml-2">
                    <span class="fas fa-plus"></span> Create New
                </a>
                
                <a href="./?page=transactions/manage_transaction_old" class="btn btn-flat btn-primary btn-sm ml-2">
                    <span class="fas fa-plus"></span> Old Jobs Only
                </a>
                
                <a href="./?page=transactions/multi_transaction" class="btn btn-flat btn-success btn-sm ml-2">
                    <span class="fas fa-layer-group"></span> Bulk Entry
                </a>
            </div>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <!-- Desktop Filter Form -->
            <div class="desktop-filter-form">
                <div class="card shadow mb-4 no-print">
                    <div class="card-body">
                        <form action="" method="GET" id="filter-form">
                            <input type="hidden" name="page" value="transactions">    
                            <div class="row align-items-end">
                                <div class="col-md-3">
                                    <label>From Date</label>
                                    <input type="date" name="date_from" value="<?= isset($_GET['date_from']) ? $_GET['date_from'] : '' ?>" class="form-control">
                                </div>
                                <div class="col-md-3">
                                    <label>To Date</label>
                                    <input type="date" name="date_to" value="<?= isset($_GET['date_to']) ? $_GET['date_to'] : '' ?>" class="form-control">
                                </div>
                                <div class="col-md-6">
                                    <button type="submit" class="btn btn-primary"><i class="fa fa-filter"></i> Filter</button>
                                    <a href="./?page=transactions" class="btn btn-default border">Reset</a>            
                                    <button type="button" onclick="printTransactions()" class="btn btn-success"><i class="fa fa-print"></i> Print</button>
                                    <button type="button" onclick="exportExcel()" class="btn btn-warning"><i class="fa fa-file-excel"></i> Excel</button>
                                    <!-- Hide Delivered Toggle (Desktop) -->
                                    <span class="desktop-hide-delivered">
                                        <label>
                                            <input type="checkbox" id="toggleDeliveredDesktop"> Hide Delivered
                                        </label>
                                    </span>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <hr class="desktop-only">

            <!-- Desktop Table View -->
            <div class="table-responsive">
                <table class="table table-hover table-striped table-bordered align-middle" id="transaction-list">
                    <colgroup>
    <col width="4%">
    <col width="9%">
    <col width="10%">
    <col width="26%">
    <col width="12%">
    <col width="10%">
    <col width="5%">
    <col width="8%">
    <col width="8%">
    <col width="8%">
</colgroup>
                    <thead>
                        <tr class="bg-navy">
                            <th class="text-center">#</th>
                            <th>Date</th>
                            <th>Job/Code</th>
                            <th>Client</th>
                            <th>Item/Model</th>
                            <th>Fault</th>
                            <th>Locate</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th class="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        $where_cond = "";
                        $date_from = isset($_GET['date_from']) ? $_GET['date_from'] : '';
                        $date_to = isset($_GET['date_to']) ? $_GET['date_to'] : '';

                        if(!empty($date_from) && !empty($date_to)){
                            $where_cond = " WHERE date(t.date_created) BETWEEN '{$date_from}' AND '{$date_to}' ";
                        }

                        $qry = $conn->query("SELECT t.*, 
                            c.firstname, c.middlename, c.lastname, c.contact, c.image_path as client_img, c.opening_balance, c.id as client_tbl_id,
                            (SELECT SUM(amount) FROM transaction_list tl WHERE tl.client_name = c.id AND tl.status = 5) as total_billed,
                            (SELECT SUM(amount + discount) FROM client_payments cp WHERE cp.client_id = c.id) as total_paid,
							(SELECT SUM(total_amount) FROM direct_sales ds WHERE ds.client_id = c.id) as total_sale,
                            t.code 
                     FROM `transaction_list` t 
                     INNER JOIN client_list c ON t.client_name = c.id 
                     {$where_cond} 
                     ORDER BY job_id DESC, date_created DESC");

                        $total_amount = 0;
                        $total_pending = 0;
                        $total_completed = 0;

                        while($row = $qry->fetch_assoc()):
                            $fullname = trim($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
                            $date_created = $row['date_created'];
                            $job_id = $row['job_id'];
                            $code = !empty($row['code']) ? $row['code'] : 'No Code';
                            $contact = $row['contact'];
                            $item = $row['item'];
                            $fault = $row['fault'];
                            $locate = $row['uniq_id'];
                            $amount = $row['amount'];
                            $status = $row['status'];
                            $client_img = $row['client_img'];
                            
                            $calc_sale = $row['total_sale'] ?? 0;
							$calc_billed = $row['total_billed'] ?? 0;
                            $calc_paid = $row['total_paid'] ?? 0;
                            $calc_opening = $row['opening_balance'] ?? 0;
                            $current_balance = ($calc_opening + $calc_billed + $calc_sale) - $calc_paid;
                            
                            // Balance Text formatting
                            if($current_balance > 0){
                                $bal_display = '<span class="badge badge-danger ml-1" style="font-size:0.7rem">Due: ₹' . number_format($current_balance, 2) . '</span>';
                            } elseif($current_balance < 0) {
                                $bal_display = '<span class="badge badge-success ml-1" style="font-size:0.7rem">Adv: ₹' . number_format(abs($current_balance), 2) . '</span>';
                            } else {
                                $bal_display = '<span class="badge badge-secondary ml-1" style="font-size:0.7rem">Bal: ₹0.00</span>';
                            }
                            
                            // Stats calculation
                            $total_amount += $amount;
                            if(in_array($status, [3,5])) $total_completed++;
                            if($status == 0) $total_pending++;
                            
                            $status_text = '';
                            switch($status){
                                case 0: $status_text = 'Pending'; break;
                                case 1: $status_text = 'On-Progress'; break;
                                case 2: $status_text = 'Done'; break;
                                case 3: $status_text = 'Paid'; break;
                                case 4: $status_text = 'Cancelled'; break;
                                case 5: $status_text = 'Delivered'; break;
                            }
                        ?> 
                        <tr>
                            <td class="text-center"><?php echo $i++; ?></td>
                            <td class="py-2" data-order="<?= date("YmdHis", strtotime($date_created)) ?>">
                                <div class="d-flex flex-column" style="line-height: 1.3;">
                                    <small class="text-muted">
                                        <i class="fa fa-calendar-alt mr-1 text-primary"></i>
                                        <?= date("d M Y", strtotime($date_created)) ?>
                                    </small>
                                    <small class="text-muted">
                                        <i class="fa fa-clock mr-1 text-info"></i>
                                        <?= date("h:i A", strtotime($date_created)) ?>
                                    </small>
                                </div>
                            </td>
                            <td class="py-2">
                                <div class="d-flex flex-column" style="line-height: 1.3;">
                                    <a href="./?page=transactions/view_details&id=<?= $row['id'] ?>" class="text-decoration-none">
                                        <small class="text-primary font-weight-bold">
                                            <i class="fa fa-tag mr-1"></i><?= $job_id ?>
                                        </small>
                                    </a>
                                    
                                    <a href="./?page=transactions/view_details&id=<?= $row['id'] ?>" class="text-decoration-none">
                                        <small class="text-danger">
                                            <i class="fa fa-barcode mr-1"></i><?= $code ?>
                                        </small>
                                    </a>
                                </div>
                            </td>
                            <!-- Update the client cell HTML in the desktop table -->
<td class="align-middle">
    <div class="client-cell">
        <img src="<?php echo validate_image($row['client_img']) ?>" 
            class="table-client-avatar" 
            onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'"
            alt="<?= htmlspecialchars($fullname) ?>">

        <div class="d-flex flex-column justify-content-center" style="min-width: 0;">
            <!-- Client Name - Smaller -->
            <a href="./?page=clients/view_client&id=<?php echo $row['client_name'] ?>" 
               style="color: inherit; text-decoration: none; line-height: 1.1; margin-bottom: 2px; display: block;">
                <span class="font-weight-bold text-primary" style="font-size: 0.85rem;">
                    <?= $fullname ?>
                </span>
            </a>

            <!-- Balance - Smaller -->
            <div class="mt-1" style="margin-bottom: 2px !important;">
                <?= $bal_display ?>
            </div>

            <!-- WhatsApp - Smaller -->
            <small class="text-success" style="font-size: 0.75rem;">
                <?php if(!empty($contact)): ?>
                    <a href="https://wa.me/91<?= preg_replace('/\D/', '', $contact) ?>" 
                       target="_blank" 
                       class="text-success font-weight-bold"
                       style="font-size: 0.75rem; text-decoration: none;">
                        <i class="fab fa-whatsapp mr-1" style="font-size: 0.7rem;"></i>
                        <?= $contact ?>
                    </a>
                <?php else: ?>
                    <span class="text-muted" style="font-size: 0.7rem;">No Contact</span>
                <?php endif; ?>
            </small>
        </div>
    </div>
</td>
                            <td class="py-3"><?= $item ?></td>
                            <td class="py-3"><?= $fault ?></td>
                            <td class="py-3"><?= $locate ?></td>
                            <td class="text-right" data-order="<?= (float)$row['amount'] ?>">
                                ₹ <?= number_format($row['amount'], 2) ?>
                            </td>
                            <td class="py-3 text-center">
                                <?php 
                                switch($status){
                                    case 0: echo '<span class="badge badge-secondary px-3">Pending</span>'; break;
                                    case 1: echo '<span class="badge badge-primary px-3">On-Progress</span>'; break;
                                    case 2: echo '<span class="badge badge-info px-3">Done</span>'; break;
                                    case 3: echo '<span class="badge badge-success px-3">Paid</span>'; break;
                                    case 4: echo '<span class="badge badge-danger px-3">Cancelled</span>'; break;
                                    case 5: 
                                        echo '<span class="badge badge-warning px-3">Delivered</span>'; 
                                        if(!empty($row['date_completed'])){
                                            echo '<br><small class="text-muted" style="font-size:0.75rem;"><i class="fa fa-clock"></i> '.date("d M, h:i A", strtotime($row['date_completed'])).'</small>';
                                        }
                                        break;
                                }
                                ?>
                            </td>
                            <td class="py-3 text-center">
                                <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
                                <div class="dropdown-menu" role="menu">
                                    <a class="dropdown-item" href="./?page=transactions/view_details&id=<?php echo $row['id'] ?>"><span class="fa fa-eye text-primary"></span> View</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item" href="javascript:void(0)" onclick="sendWA('<?php echo $job_id ?>', '<?php echo $contact ?>', '<?php echo $amount ?>', '<?php echo $fullname ?>', '<?php echo $code ?>', '<?php echo addslashes($item) ?>', '<?php echo $status ?>')">
                                        <span class="fab fa-whatsapp text-success"></span> WhatsApp
                                    </a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item" href="../pdf/bill_template.php?job_id=<?php echo $job_id ?>" target="_blank"><span class="fa fa-print text-info"></span> Print Bill</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item edit_data" href="./?page=transactions/manage_transaction&id=<?php echo $row['id'] ?>"><span class="fa fa-edit text-info"></span> Edit</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item edit_data" href="./?page=transactions/manage_transaction_old&id=<?php echo $row['id'] ?>"><span class="fa fa-edit text-info"></span> Old Edit</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                                </div>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>

            <!-- ==================== MOBILE VIEW REDESIGN ==================== -->
            <div class="mobile-view" style="display: none;">
                <!-- Mobile Header -->
                <div class="mobile-header">
                    <h4><i class="fas fa-exchange-alt"></i> Transaction History</h4>
                    
                    <!-- Quick Stats (optional) -->
            <!--        <div class="mobile-stats">
                        <div class="stat-card">
                            <h3>₹<?= number_format($total_amount, 0) ?></h3>
                            <p>Total Value</p>
                        </div>
                        <div class="stat-card">
                            <h3><?= $total_completed ?></h3>
                            <p>Completed</p>
                        </div>
                        <div class="stat-card">
                            <h3><?= $total_pending ?></h3>
                            <p>Pending</p>
                        </div>
                    </div>
                    -->
                    <!-- Search Bar -->
                    <div class="mobile-search-container">
                        <div class="mobile-search-wrapper">
                            <i class="fas fa-search mobile-search-icon"></i>
                            <input type="text" class="mobile-search-input" id="mobileSearchInput" placeholder="Search jobs, clients, items...">
                            <button class="mobile-filter-btn" onclick="openFilterModal()">
                                <i class="fas fa-filter"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Hide Delivered Toggle (Mobile) -->
                    <div class="mobile-hide-delivered">
                        <label>
                            <input type="checkbox" id="toggleDeliveredMobile"> Hide Delivered
                        </label>
                    </div>
                </div>

                <!-- Search Results Indicator -->
                <div class="results-indicator" id="searchResultsIndicator" style="display: none;">
                    <div>
                        Found <span class="results-count" id="mobileResultsCount">0</span> results
                    </div>
                    <button class="clear-search" onclick="clearMobileSearch()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Empty State -->
                <div class="empty-state" id="mobileEmptyState" style="display: none;">
                    <div class="empty-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h4>No transactions found</h4>
                    <p>Try adjusting your search or filter</p>
                </div>

                <!-- Transaction Cards Container -->
                <div id="transactionCardsContainer">
                    <?php 
                    $mobile_i = 1;
                    $qry_mobile = $conn->query("SELECT t.*, 
                            c.firstname, c.middlename, c.lastname, c.contact, c.image_path as client_img, c.opening_balance, c.id as client_tbl_id,
                            (SELECT SUM(amount) FROM transaction_list tl WHERE tl.client_name = c.id AND tl.status = 5) as total_billed,
                            (SELECT SUM(amount + discount) FROM client_payments cp WHERE cp.client_id = c.id) as total_paid,
                            t.code 
                     FROM `transaction_list` t 
                     INNER JOIN client_list c ON t.client_name = c.id 
                     {$where_cond} 
                     ORDER BY job_id DESC, date_created DESC");

                    while($row = $qry_mobile->fetch_assoc()):
                        $fullname = trim($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
                        $mobile_client_img = $row['client_img'];
                        
                        $status_search_text = '';
                        switch($row['status']){
                            case 0: $status_search_text = 'pending'; break;
                            case 1: $status_search_text = 'on-progress progress repairing'; break;
                            case 2: $status_search_text = 'done complete ready'; break;
                            case 3: $status_search_text = 'paid billing'; break;
                            case 4: $status_search_text = 'cancelled rejected'; break;
                            case 5: $status_search_text = 'delivered success'; break;
                        }

                        $search_data = strtolower($row['job_id'] . ' ' . $fullname . ' ' . $row['item'] . ' ' . $row['fault'] . ' ' . $row['code'] . ' ' . $row['uniq_id'] . ' ' . $status_search_text);
                        
                        $mobile_job_id = $row['job_id'];
                        $mobile_code = !empty($row['code']) ? $row['code'] : 'No Code';
                        $mobile_contact = $row['contact'];
                        $mobile_item = $row['item'];
                        $mobile_fault = $row['fault'];
                        $mobile_locate = $row['uniq_id'];
                        $mobile_amount = $row['amount'];
                        $mobile_status = $row['status'];
                        $mobile_id = $row['id'];
                        
                        // Balance Calculation
                        $calc_billed = $row['total_billed'] ?? 0;
                        $calc_paid = $row['total_paid'] ?? 0;
                        $calc_opening = $row['opening_balance'] ?? 0;
                        $current_balance = ($calc_opening + $calc_billed) - $calc_paid;

                        // Balance Text formatting
                        if($current_balance > 0){
                            $bal_display = '<span class="badge badge-danger" style="font-size:0.75rem; background:#fc8181; padding:3px 8px; border-radius:10px">Due: ₹' . number_format($current_balance, 2) . '</span>';
                        } elseif($current_balance < 0) {
                            $bal_display = '<span class="badge badge-success" style="font-size:0.75rem; background:#68d391; padding:3px 8px; border-radius:10px">Adv: ₹' . number_format(abs($current_balance), 2) . '</span>';
                        } else {
                            $bal_display = '<span class="badge badge-secondary" style="font-size:0.75rem; background:#a0aec0; padding:3px 8px; border-radius:10px">Bal: ₹0.00</span>';
                        }
                    ?>
                    <div class="mobile-transaction-card status-border-<?= $mobile_status ?>" data-search="<?php echo htmlspecialchars($search_data) ?>" data-status="<?= $mobile_status ?>">
                        <!-- Card Top Section -->
                        <div class="card-top">
                            <div class="job-info">
                                <h3>
                                    <a href="./?page=transactions/view_details&id=<?= $mobile_id ?>">
                                        Job #<?= $mobile_job_id ?>
                                    </a>
                                </h3>
                                <div class="job-meta">
                                    <span class="job-code"><?= $mobile_code ?></span>
                                    <span class="job-date">
                                        <i class="far fa-calendar-alt"></i>
                                        <?= date("d M", strtotime($row['date_created'])) ?>
                                    </span>
                                </div>
                                <?php if($mobile_status == 5 && !empty($row['date_completed'])): ?>
                                <div class="date-completed">
                                    <i class="fas fa-check-circle text-success"></i>
                                    Delivered: <?= date("d M, h:i A", strtotime($row['date_completed'])) ?>
                                </div>
                                <?php endif; ?>
                            </div>
                            <span class="status-badge-mobile status-<?= $mobile_status ?>">
                                <?php 
                                switch($mobile_status){
                                    case 0: echo 'Pending'; break;
                                    case 1: echo 'Progress'; break;
                                    case 2: echo 'Done'; break;
                                    case 3: echo 'Paid'; break;
                                    case 4: echo 'Cancelled'; break;
                                    case 5: echo 'Delivered'; break;
                                }
                                ?>
                            </span>
                        </div>

                        <!-- Client Info -->
                        <div class="card-client">
                            <img src="<?php echo validate_image($mobile_client_img) ?>" 
                                 class="client-avatar"
                                 onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
                            <div class="client-details">
                                <div class="client-name">
                                    <a href="./?page=clients/view_client&id=<?= $row['client_name'] ?>" class="text-dark">
                                        <?= $fullname ?>
                                    </a>
                                </div>
                                <?php if(!empty($mobile_contact)): ?>
                                <div class="client-phone">
                                    <i class="fab fa-whatsapp"></i>
                                    <a href="https://wa.me/91<?= preg_replace('/\D/', '', $mobile_contact) ?>" target="_blank">
                                        <?= $mobile_contact ?>
                                    </a>
                                </div>
                                <?php endif; ?>
                                <div class="client-balance">
                                    <?= $bal_display ?>
                                </div>
                            </div>
                        </div>

                        <!-- Transaction Details - More Informative -->
                        <div class="card-details">
                            <div class="detail-row">
                                <div class="detail-label">Item/Model</div>
                                <div class="detail-value item-model"><?= $mobile_item ?></div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Fault/Issue</div>
                                <div class="detail-value fault-text"><?= $mobile_fault ?></div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Location ID</div>
                                <div class="detail-value"><?= $mobile_locate ?></div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Bill Amount</div>
                                <div class="detail-value amount-display">₹<?= number_format($mobile_amount, 2) ?></div>
                            </div>
                        </div>

                        <!-- Additional Information -->
                        <div class="card-extra-info">
                            <div class="extra-info-row">
                                <span class="extra-label">Created:</span>
                                <span class="extra-value"><?= date("d M Y, h:i A", strtotime($row['date_created'])) ?></span>
                            </div>
                            <?php if(!empty($row['date_updated']) && $row['date_updated'] != $row['date_created']): ?>
                            <div class="extra-info-row">
                                <span class="extra-label">Last Updated:</span>
                                <span class="extra-value"><?= date("d M Y, h:i A", strtotime($row['date_updated'])) ?></span>
                            </div>
                            <?php endif; ?>
                        </div>

                        <!-- Action Buttons - ALL 6 BUTTONS -->
                        <div class="card-actions">
                            <a href="./?page=transactions/view_details&id=<?= $mobile_id ?>" class="action-btn btn-view">
                                <i class="fas fa-eye"></i>
                                <span>View</span>
                            </a>
                            <a href="javascript:void(0)" onclick="sendWA('<?= $mobile_job_id ?>', '<?= $mobile_contact ?>', '<?= $mobile_amount ?>', '<?= $fullname ?>', '<?= $mobile_code ?>', '<?= addslashes($mobile_item) ?>', '<?= $mobile_status ?>')" class="action-btn btn-whatsapp">
                                <i class="fab fa-whatsapp"></i>
                                <span>WhatsApp</span>
                            </a>
                            <a href="../pdf/bill_template.php?job_id=<?= $mobile_job_id ?>" target="_blank" class="action-btn btn-print">
                                <i class="fas fa-print"></i>
                                <span>Print Bill</span>
                            </a>
                            <a href="./?page=transactions/manage_transaction_old&id=<?= $mobile_id ?>" class="action-btn btn-old-edit">
                                <i class="fas fa-history"></i>
                                <span>Old Edit</span>
                            </a>
                            <a href="./?page=transactions/manage_transaction&id=<?= $mobile_id ?>" class="action-btn btn-edit">
                                <i class="fas fa-edit"></i>
                                <span>Edit</span>
                            </a>
                            <a href="javascript:void(0)" class="action-btn btn-delete delete_data" data-id="<?= $mobile_id ?>">
                                <i class="fas fa-trash"></i>
                                <span>Delete</span>
                            </a>
                        </div>
                    </div>
                    <?php 
                    $mobile_i++;
                    endwhile; 
                    ?>
                </div>

                <!-- Filter Modal -->
                <div class="filter-modal" id="filterModal">
                    <div class="filter-content">
                        <div class="filter-header">
                            <h3>Filter Transactions</h3>
                            <button class="close-filter" onclick="closeFilterModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="filter-body">
                            <form id="mobileFilterForm">
                                <input type="hidden" name="page" value="transactions">
                                <div class="form-group">
                                    <label for="mobile_date_from">From Date</label>
                                    <input type="date" name="date_from" id="mobile_date_from" 
                                           value="<?= isset($_GET['date_from']) ? $_GET['date_from'] : '' ?>" 
                                           class="form-control">
                                </div>
                                <div class="form-group">
                                    <label for="mobile_date_to">To Date</label>
                                    <input type="date" name="date_to" id="mobile_date_to" 
                                           value="<?= isset($_GET['date_to']) ? $_GET['date_to'] : '' ?>" 
                                           class="form-control">
                                </div>
                                <div class="form-group">
                                    <label for="mobile_status">Status</label>
                                    <select name="status" id="mobile_status" class="form-control">
                                        <option value="">All Status</option>
                                        <option value="0">Pending</option>
                                        <option value="1">On-Progress</option>
                                        <option value="2">Done</option>
                                        <option value="3">Paid</option>
                                        <option value="4">Cancelled</option>
                                        <option value="5">Delivered</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="filter-actions">
                            <button type="button" class="btn-reset" onclick="resetMobileFilter()">
                                Reset
                            </button>
                            <button type="button" class="btn-apply" onclick="applyMobileFilter()">
                                Apply Filter
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Floating Action Button - FIXED POSITION -->
                <div class="fab-container">
                    <button class="fab-main" onclick="toggleFabMenu()">
                        <i class="fas fa-plus"></i>
                    </button>
                    <div class="fab-menu" id="fabMenu">
                        <a href="./?page=transactions/manage_transaction" class="fab-item">
                            <i class="fas fa-plus-circle text-primary"></i>
                            <span class="fab-text">Create New</span>
                        </a>
                        <a href="./?page=transactions/manage_transaction_old" class="fab-item">
                            <i class="fas fa-history text-info"></i>
                            <span class="fab-text">Old Jobs</span>
                        </a>
                        <a href="./?page=transactions/multi_transaction" class="fab-item">
                            <i class="fas fa-layer-group text-success"></i>
                            <span class="fab-text">Bulk Entry</span>
                        </a>
                        <hr style="margin: 8px 0; border-color: #e2e8f0;">
                        <a href="javascript:void(0)" onclick="printReport()" class="fab-item">
                            <i class="fas fa-print text-warning"></i>
                            <span class="fab-text">Print Report</span>
                        </a>
                        <a href="javascript:void(0)" onclick="exportExcel()" class="fab-item">
                            <i class="fas fa-file-excel text-success"></i>
                            <span class="fab-text">Export Excel</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Desktop Functions
function printTransactions() {
    var from = $('[name="date_from"]').val();
    var to = $('[name="date_to"]').val();
    var url = 'transactions/print_transactions.php?from=' + from + '&to=' + to;
    var nw = window.open(url, "_blank", "width=1000,height=800");
}

function exportExcel() {
    var from = $('[name="date_from"]').val();
    var to = $('[name="date_to"]').val();
    window.location.href = 'transactions/print_transactions.php?export=excel&from=' + from + '&to=' + to;
}

function sendWA(job_id, phone, amount, client_name, code, item, status) {
    phone = phone.replace(/\D/g, '');
    if (phone.length < 10) { alert("Valid mobile number nahi mila!"); return; }
    
    let msg = "";
    let formattedAmount = parseFloat(amount).toLocaleString('en-IN');
    let businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";

    switch (parseInt(status)) {
        case 0:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Aapka *${item}* repair ke liye register ho gaya hai. 📝\n\n` +
                  `📋 *Details:*\n` +
                  `Job ID: #${job_id}\n` +
                  `Code: #${code}\n` +
                  `Status: *Received/Pending*\n\n` +
                  `Hum jald hi aapke device ko check karke update denge. Dhanyavaad! ❤️\n\n` +
                  `${businessName}`;
            break;

        case 1:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Aapke *${item}* (Job ID: #${job_id}) (Code: #${code}) par kaam shuru kar diya gaya hai. 🛠️\n\n` +
                  `Status: *In-Progress/Repairing*\n\n` +
                  `Hamare technician isse jald se jald theek karne ki koshish kar rahe hain. ✨\n\n` +
                  `${businessName}`;
            break;

        case 2:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Khushkhabri! Aapka *${item}* repair complete ho gaya hai. ✅\n\n` +
                  `📋 *Details:*\n` +
                  `Job ID: #${job_id}\n` +
                  `Code: #${code}\n` +
                  `Bill Amount: *₹${formattedAmount}*\n\n` +
                  `Aap workshop par aakar apna device collect kar sakte hain. 🛍️\n\n` +
                  `Dhanyavaad! ❤️\n\n` +
                  `${businessName}`;
            break;

        case 3:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Aapka *${item}* (Job ID: #${job_id}) (Code: #${code}) deliver kar diya gaya hai. 🏁\n\n` +
                  `Total Paid: *₹${formattedAmount}*\n\n` +
                  `V-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n` +
                  `${businessName}`;
            break;

        case 4:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Aapka Job ID: #${job_id} (Code: #${code}) (*${item}*) cancel kar diya gaya hai. ❌\n\n` +
                  `Kripya adhik jankari ke liye workshop par sampark karein. 🙏\n\n` +
                  `${businessName}`;
            break;
            
        case 5:
            msg = `Namaste ${client_name} ji 🙏!\n\n` +
                  `Aapka *${item}* (Job ID: #${job_id}) (Code: #${code}) deliver kar diya gaya hai. 🏁\n\n` +
                  `Total Paid: *₹${formattedAmount}*\n\n` +
                  `V-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n` +
                  `${businessName}`;
            break;

        default:
            msg = `Namaste ${client_name} ji 🙏!\n\nAapka Job ID: #${job_id} (${item}) ka status update kar diya gaya hai. Dhanyavaad! ❤️`;
    }

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

$(document).ready(function(){
    // Desktop DataTable
    var table = $('#transaction-list').DataTable({
        "pageLength": 50,
        "lengthMenu": [ [10, 25, 50, 100, -1], [10, 25, 50, 100, "All"] ],
        "order": [[0, "asc"]],
        "language": {
            "search": "Search Table:",
            "lengthMenu": "Show _MENU_ entries"
        },
        "autoWidth": false, // Prevent automatic width adjustment
        "columnDefs": [
            { "width": "4%", "targets": 0 },
            { "width": "9%", "targets": 1 },
            { "width": "10%", "targets": 2 },
            { "width": "25%", "targets": 3 },
            { "width": "12%", "targets": 4 },
            { "width": "10%", "targets": 5 },
            { "width": "5%", "targets": 6 },
            { "width": "8%", "targets": 7 },
            { "width": "8%", "targets": 8 },
            { "width": "9%", "targets": 9 }
        ]
    });

    // Hide Delivered Filter for DataTable
    $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
        var hideDelivered = $('#toggleDeliveredDesktop').is(':checked');
        if (!hideDelivered) return true; // show all

        // Check status column (index 8)
        var status = data[8] || '';
        // If status contains "Delivered", hide it (return false)
        if (status.indexOf('Delivered') !== -1) {
            return false;
        }
        return true;
    });

    // Redraw table when checkbox changes
    $('#toggleDeliveredDesktop').on('change', function() {
        table.draw();
        // Also sync mobile checkbox
        $('#toggleDeliveredMobile').prop('checked', $(this).is(':checked')).trigger('change');
    });

    // Mobile Search Functionality
    let searchTimeout;
    function performMobileSearch() {
        var searchTerm = $('#mobileSearchInput').val().toLowerCase().trim();
        var resultsCount = 0;
        var visibleCards = 0;
        
        // First filter by search term
        $('.mobile-transaction-card').each(function() {
            var searchData = $(this).attr('data-search').toLowerCase();
            
            if (searchTerm === "" || searchData.indexOf(searchTerm) > -1) {
                $(this).show();
                resultsCount++;
                visibleCards++;
            } else {
                $(this).hide();
            }
        });
        
        // Then apply hide delivered if needed
        if ($('#toggleDeliveredMobile').is(':checked')) {
            $('.mobile-transaction-card[data-status="5"]').hide();
            // Recalculate visible count
            visibleCards = $('.mobile-transaction-card:visible').length;
        }
        
        $('#mobileResultsCount').text(resultsCount);
        if (searchTerm !== "") {
            $('#searchResultsIndicator').show();
        } else {
            $('#searchResultsIndicator').hide();
        }
        
        if (visibleCards === 0) {
            $('#mobileEmptyState').show();
        } else {
            $('#mobileEmptyState').hide();
        }
    }
    
    $('#mobileSearchInput').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performMobileSearch, 300);
    });

    // Mobile Hide Delivered Toggle
    $('#toggleDeliveredMobile').on('change', function() {
        var isChecked = $(this).is(':checked');
        // Sync desktop checkbox
        $('#toggleDeliveredDesktop').prop('checked', isChecked).trigger('change'); // triggers DataTable redraw
        // Apply to mobile cards (in addition to search)
        if (isChecked) {
            $('.mobile-transaction-card[data-status="5"]').hide();
        } else {
            // Re-show all that match current search
            performMobileSearch(); // re-run search to show all matching
        }
    });

    // FAB Menu Toggle
    window.toggleFabMenu = function() {
        $('#fabMenu').toggleClass('active');
    }

    // Close FAB menu when clicking outside
    $(document).click(function(event) {
        if (!$(event.target).closest('.fab-container').length) {
            $('#fabMenu').removeClass('active');
        }
    });

    // Filter Modal Functions
    window.openFilterModal = function() {
        $('#filterModal').addClass('active');
    }

    window.closeFilterModal = function() {
        $('#filterModal').removeClass('active');
    }

    window.resetMobileFilter = function() {
        $('#mobileFilterForm')[0].reset();
    }

    window.applyMobileFilter = function() {
        var formData = $('#mobileFilterForm').serialize();
        window.location.href = './?' + formData;
    }

    // Clear Search
    window.clearMobileSearch = function() {
        $('#mobileSearchInput').val('');
        performMobileSearch();
    }

    // Responsive view switching
    function checkView() {
        if ($(window).width() <= 768) {
            $('.mobile-view').show();
            $('.table-responsive').hide();
            $('.desktop-filter-form').hide();
            $('.desktop-export-buttons').hide();
        } else {
            $('.mobile-view').hide();
            $('.table-responsive').show();
            $('.desktop-filter-form').show();
            $('.desktop-export-buttons').show();
        }
    }
    
    // Initial check
    checkView();
    
    // Check on window resize
    $(window).resize(function() {
        checkView();
    });

    // Delete functionality
    $(document).on('click', '.delete_data', function(){
        _conf("Are you sure to delete this transaction?","delete_transaction",[$(this).attr('data-id')])
    });

    // Close filter modal when clicking outside
    $('#filterModal').click(function(e) {
        if (e.target.id === 'filterModal') {
            closeFilterModal();
        }
    });
});

// EXPORT FUNCTIONS
function printReport() {
    var form = document.getElementById('filter-form');
    var printWindow = window.open('./?page=transactions/print_report' + getFilterParams(), '_blank');
}

function exportPDF() {
    alert_toast("For PDF export, please use the Print button and select 'Save as PDF' in the print dialog", 'info', 5000);
    window.open('./?page=transactions/pdf_report' + getFilterParams(), '_blank');
}

function getFilterParams() {
    var dateFrom = document.querySelector('input[name="date_from"]')?.value || '';
    var dateTo = document.querySelector('input[name="date_to"]')?.value || '';
    
    var params = '';
    if(dateFrom) params += '&date_from=' + dateFrom;
    if(dateTo) params += '&date_to=' + dateTo;
    
    return params ? '?' + params.substring(1) : '';
}

function delete_transaction($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=delete_transaction",
        method:"POST",
        data:{id: $id},
        dataType:"json",
        success:function(resp){
            if(resp.status == 'success') location.reload();
            else alert_toast("An error occurred.",'error');
            end_loader();
        }
    });
}
</script>