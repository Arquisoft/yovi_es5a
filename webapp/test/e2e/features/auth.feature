Feature: Authentication
  Validate the authentication form

  Scenario: Successful authentitcation
    Given The authentication page is open
    When I enter a specific username, "PrUeBa" as the password and submit
    Then I should see the home page