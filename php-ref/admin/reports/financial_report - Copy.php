<?php 
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");
?>
<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title text-navy font-weight-bold"><i class="fa fa-book mr-2"></i> Workshop Financial Report</h3>
    </div>
    <div class="card-body">
        <div class="row no-print mb-4 border-bottom pb-3">
            <div class="col-md-12">
                <form action="" id="filter-report">
                    <input type="hidden" name="page" value="reports/financial_report">
                    <div class="row align-items-end">
                        <div class="col-md-3">
                            <label>From Date</label>
                            <input type="date" name="from" class="form-control form-control-sm" value="<?= $from ?>">
                        </div>
                        <div class="col-md-3">
                            <label>To Date</label>
                            <input type="date" name="to" class="form-control form-control-sm" value="<?= $to ?>">
                        </div>
                        <div class="col-md-6">
                            <button class="btn btn-navy bg-navy btn-sm shadow-sm"><i class="fa fa-filter"></i> Filter</button>
                            <button class="btn btn-success btn-sm shadow-sm" type="button" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div id="out-print">
            <style>
                .section-header { background: #001f3f; color: white; padding: 5px 10px; margin-top: 15px; border-radius: 3px; }
                .amount-col { text-align: right; font-weight: bold; }
                @media print { .no-print { display:none; } }
            </style>
            
            <h4 class="text-center font-weight-bold">Trading & Cash Flow Statement</h4>
            <p class="text-center"><?= date("d M Y", strtotime($from)) ?> se <?= date("d M Y", strtotime($to)) ?></p>

            <?php 
            // --- 1. INCOME (Aawak) ---
            
            // A. Service Revenue (From transaction_services table, column 'price')
            $service_rev = $conn->query("SELECT SUM(ts.price) 
                                         FROM transaction_services ts 
                                         INNER JOIN transaction_list t ON ts.transaction_id = t.id 
                                         WHERE date(t.date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
            
            // B. Parts Revenue (From transaction_products, columns 'qty' * 'price')
            $parts_rev = $conn->query("SELECT SUM(tp.qty * tp.price) 
                                       FROM transaction_products tp 
                                       INNER JOIN transaction_list t ON tp.transaction_id = t.id 
                                       WHERE date(t.date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
            
            // C. Direct Sales (From direct_sales table, column 'total_amount')
            $direct_sales_rev = $conn->query("SELECT SUM(total_amount) 
                                              FROM direct_sales 
                                              WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

            $total_revenue = $service_rev + $parts_rev + $direct_sales_rev;

            // --- 2. EXPENSES (Jawak) ---

            // A. Inventory Investment (Stock Kharida)
            // Logic: Inventory_list has NO type column, so all entries are Purchases.
            // Using: inventory_list.quantity * product_list.price
            $stock_investment = $conn->query("SELECT SUM(i.quantity * p.price) 
                                              FROM inventory_list i 
                                              INNER JOIN product_list p ON i.product_id = p.id 
                                              WHERE date(i.stock_date) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

            // B. General Expenses
            $expenses = $conn->query("SELECT SUM(amount) FROM expense_list WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
            
            // C. Loan EMI
            $emi_paid = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
            
            // D. Staff Advance
            $advance = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE date(date_paid) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

            $total_expenses = $stock_investment + $expenses + $emi_paid + $advance;
            $net_profit = $total_revenue - $total_expenses;
            ?>

            
            <div class="row">
                <div class="col-md-7 border-right">
                    <div class="section-header">Income vs Expenses</div>
                    <table class="table table-sm table-bordered mt-2">
                        <tr class="bg-light"><th>Income Source</th><th class="text-right">Amount</th></tr>
                        <tr><td>Service Charges (Jobcards)</td><td class="amount-col"><?= number_format($service_rev, 2) ?></td></tr>
                        <tr><td>Parts Sold (In Repairs)</td><td class="amount-col"><?= number_format($parts_rev, 2) ?></td></tr>
                        <tr><td>Direct Counter Sales</td><td class="amount-col"><?= number_format($direct_sales_rev, 2) ?></td></tr>
                        <tr class="table-info font-weight-bold"><td>Total Income (A)</td><td class="amount-col"><?= number_format($total_revenue, 2) ?></td></tr>
                        
                        <tr class="bg-light"><th>Expenses / Outflow</th><th class="text-right">Amount</th></tr>
                        <tr><td>Stock Purchase (Inventory Added)</td><td class="amount-col text-danger"><?= number_format($stock_investment, 2) ?></td></tr>
                        <tr><td>Shop Expenses</td><td class="amount-col text-danger"><?= number_format($expenses, 2) ?></td></tr>
                        <tr><td>Staff/Mechanic Advance</td><td class="amount-col text-danger"><?= number_format($advance, 2) ?></td></tr>
                        <tr><td>Loan EMI Paid</td><td class="amount-col text-danger"><?= number_format($emi_paid, 2) ?></td></tr>
                        <tr class="bg-light font-weight-bold"><td>Total Expenses (B)</td><td class="amount-col text-danger"><?= number_format($total_expenses, 2) ?></td></tr>
                        
                        <tr class="<?= $net_profit >= 0 ? 'bg-success' : 'bg-danger' ?> text-white font-weight-bold" style="font-size: 1.1rem;">
                            <td>NET CASH FLOW (A - B)</td>
                            <td class="amount-col">₹ <?= number_format($net_profit, 2) ?></td>
                        </tr>
                    </table>
                </div>

                <div class="col-md-5">
                    <div class="section-header">Current Status (Balance Sheet)</div>
                    <table class="table table-sm table-bordered mt-2">
                        <tr>
                            <td><strong>Est. Stock Value</strong><br><small>(Total In - Total Sold) * Price</small></td>
                            <td class="amount-col">
                                <?php 
                                // Logic: Stock = (Total Inventory Added) - (Sold in Service) - (Sold Directly)
                                // Only calculate for products that exist
                                $stock_query = "SELECT SUM(
                                    (
                                        COALESCE((SELECT SUM(quantity) FROM inventory_list WHERE product_id = p.id), 0) - 
                                        COALESCE((SELECT SUM(qty) FROM transaction_products WHERE product_id = p.id), 0) - 
                                        COALESCE((SELECT SUM(qty) FROM direct_sale_items WHERE product_id = p.id), 0)
                                    ) * p.price
                                ) as stock_val FROM product_list p";
                                
                                $stock_val = $conn->query($stock_query)->fetch_assoc()['stock_val'] ?? 0;
                                echo number_format($stock_val, 2);
                                ?>
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Total Loan Outstanding</strong></td>
                            <td class="amount-col">
                                <?php 
                                $lenders = $conn->query("SELECT id, emi_amount, tenure_months FROM lender_list WHERE status = 1");
                                $total_debt = 0;
                                while($lr = $lenders->fetch_assoc()){
                                    $paid = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE lender_id = '{$lr['id']}'")->fetch_array()[0] ?? 0;
                                    $total_debt += ($lr['emi_amount'] * $lr['tenure_months']) - $paid;
                                }
                                echo number_format($total_debt, 2);
                                ?>
                            </td>
                        </tr>
                    </table>
                    <div class="alert alert-info mt-3">
                        <small><strong>Note:</strong> Since Cost Price is not in database, this report assumes "Stock Purchased" as the primary expense for calculation.</small>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
$(function(){
    $('#filter-report').submit(function(e){
        e.preventDefault();
        location.href = "./?page=reports/financial_report&"+$(this).serialize();
    });
})
</script>