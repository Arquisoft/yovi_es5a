Feature: Game
  Validate the correct delevopment of the game
  
  Scenario: Play against local player
    Given I register the user "prueba_local" and the start game form page is open
    When I play a game against the local player
    Then I should see the victory menu