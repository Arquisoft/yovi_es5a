Feature: Users
  Consult the results and scores from a user

  Scenario: Successful consult
    Given The users page is open
    When I select a specific user
    Then I should see his game historial and global score