Feature: Personal finance account behavior

  Scenario: A recorded transaction is visible and updates the dashboard
    Given a new LKR user with a Cash account
    When the user records LKR 100 of Salary income
    Then the transaction list contains the Salary income
    And the dashboard balance is LKR 100

  Scenario: Transfers preserve total balance and are not income
    Given a new LKR user with a Cash account
    And a Savings account with LKR 0
    When the user records LKR 100 of Salary income
    And the user transfers LKR 30 from Cash to Savings
    Then Cash has LKR 70 and Savings has LKR 30
    And the dashboard balance and income are both LKR 100
