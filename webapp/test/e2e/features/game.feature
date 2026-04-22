Feature: Game
  Validate the correct delevopment of the game
  
  Scenario: Play against local player
    Given I register the user "prueba_local" and the start game form page is open
    When I play a game against the local player
    Then I should see the victory menu

  Scenario: Play against the easy bot
    Given I register the user "prueba_fácil" and the start game form page is open
    When I play a game against the easy bot
    Then I should see the victory menu

  Scenario: Play against the medium bot
    Given I register the user "prueba_medio" and the start game form page is open
    When I play a game against the medium bot
    Then I should see the victory menu

  Scenario: Play against the hard bot
    Given I register the user "prueba_dificil" and the start game form page is open
    When I play a game against the hard bot
    Then I should see the victory menu