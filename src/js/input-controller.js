import * as TestLogic from "./test-logic";
import * as TestUI from "./test-ui";
import * as TestStats from "./test-stats";
import * as Monkey from "./monkey";
import Config, * as UpdateConfig from "./config";
import * as Keymap from "./keymap";
import * as Misc from "./misc";
import * as LiveAcc from "./live-acc";
import * as Funbox from "./funbox";
import * as Sound from "./sound";
import * as Caret from "./caret";
import * as ManualRestart from "./manual-restart-tracker";
import * as Notifications from "./notifications";
import * as CustomText from "./custom-text";
import * as UI from "./ui";
import * as Settings from "./settings";
import * as LayoutEmulator from "./layout-emulator";
import * as PaceCaret from "./pace-caret";
import * as TimerProgress from "./timer-progress";
import * as TestTimer from "./test-timer";
import * as Focus from "./focus";
import * as ShiftTracker from "./shift-tracker";

let dontInsertSpace = false;
let isCapsLockHeld = false;

function handleTab(event) {
  if (TestUI.resultCalculating) {
    event.preventDefault();
  }
  if ($("#customTextPopup .textarea").is(":focus")) {
    event.preventDefault();

    let area = $("#customTextPopup .textarea")[0];

    var start = area.selectionStart;
    var end = area.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    area.value =
      area.value.substring(0, start) + "\t" + area.value.substring(end);

    // put caret at right position again
    area.selectionStart = area.selectionEnd = start + 1;

    // event.preventDefault();
    // $("#customTextPopup .textarea").val(
    //   $("#customTextPopup .textarea").val() + "\t"
    // );
    return;
  } else if (
    !TestUI.resultCalculating &&
    $("#commandLineWrapper").hasClass("hidden") &&
    $("#simplePopupWrapper").hasClass("hidden")
  ) {
    if ($(".pageTest").hasClass("active")) {
      if (Config.quickTab) {
        if (
          TestUI.resultVisible ||
          !(
            (Config.mode == "zen" && !event.shiftKey) ||
            (TestLogic.hasTab && !event.shiftKey)
          )
        ) {
          if (event.shiftKey) ManualRestart.set();
          event.preventDefault();
          if (
            TestLogic.active &&
            Config.repeatQuotes === "typing" &&
            Config.mode === "quote"
          ) {
            TestLogic.restart(true, false, event);
          } else {
            TestLogic.restart(false, false, event);
          }
        } else {
          event.preventDefault();
          handleAlpha("\t");
        }
      } else if (!TestUI.resultVisible) {
        if (
          (TestLogic.hasTab && event.shiftKey) ||
          (!TestLogic.hasTab && Config.mode !== "zen") ||
          (Config.mode === "zen" && event.shiftKey)
        ) {
          event.preventDefault();
          $("#restartTestButton").focus();
        } else {
          event.preventDefault();
          handleAlpha("\t");
        }
      }
    } else if (Config.quickTab) {
      UI.changePage("test");
    }
  }
}

function handleBackspace(event) {
  event.preventDefault();
  if (!TestLogic.active) return;
  if (
    TestLogic.input.current == "" &&
    TestLogic.input.history.length > 0 &&
    TestUI.currentWordElementIndex > 0
  ) {
    //if nothing is inputted and its not the first word
    if (
      (TestLogic.input.getHistory(TestLogic.words.currentIndex - 1) ==
        TestLogic.words.get(TestLogic.words.currentIndex - 1) &&
        !Config.freedomMode) ||
      $($(".word")[TestLogic.words.currentIndex - 1]).hasClass("hidden")
    ) {
      return;
    } else {
      if (Config.confidenceMode === "on" || Config.confidenceMode === "max")
        return;
      if (event["ctrlKey"] || event["altKey"]) {
        TestLogic.input.resetCurrent();
        TestLogic.input.popHistory();
        TestLogic.corrected.popHistory();
      } else {
        TestLogic.input.setCurrent(TestLogic.input.popHistory());
        TestLogic.corrected.setCurrent(TestLogic.corrected.popHistory());
        if (Funbox.active === "nospace") {
          TestLogic.input.setCurrent(
            TestLogic.input.current.substring(
              0,
              TestLogic.input.current.length - 1
            )
          );
        }
      }
      TestLogic.words.decreaseCurrentIndex();
      TestUI.setCurrentWordElementIndex(TestUI.currentWordElementIndex - 1);
      TestUI.updateActiveElement(true);
      Funbox.toggleScript(TestLogic.words.getCurrent());
      TestUI.updateWordElement(!Config.blindMode);
    }
  } else {
    if (Config.confidenceMode === "max") return;
    if (event["ctrlKey"] || event["altKey"]) {
      let limiter = " ";
      if (
        TestLogic.input.current.lastIndexOf("-") >
        TestLogic.input.current.lastIndexOf(" ")
      )
        limiter = "-";

      let split = TestLogic.input.current.replace(/ +/g, " ").split(limiter);
      if (split[split.length - 1] == "") {
        split.pop();
      }
      let addlimiter = false;
      if (split.length > 1) {
        addlimiter = true;
      }
      split.pop();
      TestLogic.input.setCurrent(split.join(limiter));

      if (addlimiter) {
        TestLogic.input.appendCurrent(limiter);
      }
    } else if (event.metaKey) {
      TestLogic.input.resetCurrent();
    } else {
      TestLogic.input.setCurrent(
        TestLogic.input.current.substring(0, TestLogic.input.current.length - 1)
      );
    }
    TestUI.updateWordElement(!Config.blindMode);
  }
  Sound.playClick(Config.playSoundOnClick);
  if (Config.keymapMode === "react") {
    Keymap.flashKey(event.code, true);
  } else if (Config.keymapMode === "next" && Config.mode !== "zen") {
    Keymap.highlightKey(
      TestLogic.words
        .getCurrent()
        .substring(
          TestLogic.input.current.length,
          TestLogic.input.current.length + 1
        )
        .toString()
        .toUpperCase()
    );
  }
  Caret.updatePosition();
}

function handleSpace() {
  if (!TestLogic.active) return;
  if (TestLogic.input.current === "") return;

  if (Config.mode == "zen") {
    $("#words .word.active").removeClass("active");
    $("#words").append("<div class='word active'></div>");
  }

  let currentWord = TestLogic.words.getCurrent();
  if (Funbox.active === "layoutfluid" && Config.mode !== "time") {
    const layouts = ["qwerty", "dvorak", "colemak"];
    let index = 0;
    let outof = TestLogic.words.length;
    index = Math.floor((TestLogic.input.history.length + 1) / (outof / 3));
    if (Config.layout !== layouts[index] && layouts[index] !== undefined) {
      Notifications.add(`--- !!! ${layouts[index]} !!! ---`, 0);
    }
    UpdateConfig.setLayout(layouts[index]);
    UpdateConfig.setKeymapLayout(layouts[index]);
    Keymap.highlightKey(
      TestLogic.words
        .getCurrent()
        .substring(
          TestLogic.input.current.length,
          TestLogic.input.current.length + 1
        )
        .toString()
        .toUpperCase()
    );
    Settings.groups.layout.updateButton();
  }
  dontInsertSpace = true;
  if (currentWord == TestLogic.input.current || Config.mode == "zen") {
    //correct word or in zen mode
    PaceCaret.handleSpace(true, currentWord);
    TestStats.incrementAccuracy(true);
    TestLogic.input.pushHistory();
    TestLogic.words.increaseCurrentIndex();
    TestUI.setCurrentWordElementIndex(TestUI.currentWordElementIndex + 1);
    TestUI.updateActiveElement();
    Funbox.toggleScript(TestLogic.words.getCurrent());
    Caret.updatePosition();
    TestStats.incrementKeypressCount();
    TestStats.pushKeypressWord(TestLogic.words.currentIndex);
    // currentKeypress.count++;
    // currentKeypress.words.push(TestLogic.words.currentIndex);
    if (Funbox.active !== "nospace") {
      Sound.playClick(Config.playSoundOnClick);
    }
  } else {
    //incorrect word
    PaceCaret.handleSpace(false, currentWord);
    if (Funbox.active !== "nospace") {
      if (!Config.playSoundOnError || Config.blindMode) {
        Sound.playClick(Config.playSoundOnClick);
      } else {
        Sound.playError(Config.playSoundOnError);
      }
    }
    TestStats.incrementAccuracy(false);
    TestStats.incrementKeypressErrors();
    let cil = TestLogic.input.current.length;
    if (cil <= TestLogic.words.getCurrent().length) {
      if (cil >= TestLogic.corrected.current.length) {
        TestLogic.corrected.appendCurrent("_");
      } else {
        TestLogic.corrected.setCurrent(
          TestLogic.corrected.current.substring(0, cil) +
            "_" +
            TestLogic.corrected.current.substring(cil + 1)
        );
      }
    }
    if (Config.stopOnError != "off") {
      if (Config.difficulty == "expert" || Config.difficulty == "master") {
        //failed due to diff when pressing space
        TestLogic.fail();
        return;
      }
      if (Config.stopOnError == "word") {
        TestLogic.input.appendCurrent(" ");
        TestUI.updateWordElement(true);
        Caret.updatePosition();
      }
      return;
    }
    if (Config.blindMode) $("#words .word.active letter").addClass("correct");
    TestLogic.input.pushHistory();
    TestUI.highlightBadWord(TestUI.currentWordElementIndex, !Config.blindMode);
    TestLogic.words.increaseCurrentIndex();
    TestUI.setCurrentWordElementIndex(TestUI.currentWordElementIndex + 1);
    TestUI.updateActiveElement();
    Funbox.toggleScript(TestLogic.words.getCurrent());
    Caret.updatePosition();
    // currentKeypress.count++;
    // currentKeypress.words.push(TestLogic.words.currentIndex);
    TestStats.incrementKeypressCount();
    TestStats.pushKeypressWord(TestLogic.words.currentIndex);
    if (Config.difficulty == "expert" || Config.difficulty == "master") {
      TestLogic.fail();
      return;
    } else if (TestLogic.words.currentIndex == TestLogic.words.length) {
      //submitted last word that is incorrect
      TestStats.setLastSecondNotRound();
      TestLogic.finish();
      return;
    }
  }

  TestLogic.corrected.pushHistory();

  if (
    !Config.showAllLines ||
    Config.mode == "time" ||
    (CustomText.isWordRandom && CustomText.word == 0) ||
    CustomText.isTimeRandom
  ) {
    let currentTop = Math.floor(
      document.querySelectorAll("#words .word")[
        TestUI.currentWordElementIndex - 1
      ].offsetTop
    );
    let nextTop;
    try {
      nextTop = Math.floor(
        document.querySelectorAll("#words .word")[
          TestUI.currentWordElementIndex
        ].offsetTop
      );
    } catch (e) {
      nextTop = 0;
    }

    if (nextTop > currentTop && !TestUI.lineTransition) {
      TestUI.lineJump(currentTop);
    }
  } //end of line wrap

  Caret.updatePosition();

  if (Config.keymapMode === "react") {
    Keymap.flashKey("Space", true);
  } else if (Config.keymapMode === "next" && Config.mode !== "zen") {
    Keymap.highlightKey(
      TestLogic.words
        .getCurrent()
        .substring(
          TestLogic.input.current.length,
          TestLogic.input.current.length + 1
        )
        .toString()
        .toUpperCase()
    );
  }
  if (
    Config.mode === "words" ||
    Config.mode === "custom" ||
    Config.mode === "quote" ||
    Config.mode === "zen"
  ) {
    TimerProgress.update(TestTimer.time);
  }
  if (
    Config.mode == "time" ||
    Config.mode == "words" ||
    Config.mode == "custom"
  ) {
    TestLogic.addWord();
  }
}

function handleAlpha(char) {
  if (char === "\n" && Funbox.active === "58008") {
    char = " ";
  }

  if (char === " ") {
    handleSpace();

    //insert space for expert and master or strict space,
    //otherwise dont do anything
    if (Config.difficulty !== "normal" || Config.strictSpace) {
      if (dontInsertSpace) {
        dontInsertSpace = false;
        return;
      }
    } else {
      return;
    }
  }

  //start the test
  if (
    TestLogic.input.current == "" &&
    TestLogic.input.history.length == 0 &&
    !TestLogic.active
  ) {
    if (!TestLogic.startTest()) return;
  } else {
    if (!TestLogic.active) return;
  }

  Focus.set(true);
  Caret.stopAnimation();

  //check if the char typed was correct
  let thisCharCorrect;
  let nextCharInWord;
  if (Config.mode != "zen") {
    nextCharInWord = TestLogic.words
      .getCurrent()
      .substring(
        TestLogic.input.current.length,
        TestLogic.input.current.length + 1
      );
  }

  if (nextCharInWord == char) {
    thisCharCorrect = true;
  } else {
    thisCharCorrect = false;
  }

  if (Config.language.split("_")[0] == "russian") {
    if ((char === "е" || char === "e") && nextCharInWord == "ё") {
      char = nextCharInWord;
      thisCharCorrect = true;
    }
    if (char === "ё" && (nextCharInWord == "е" || nextCharInWord === "e")) {
      char = nextCharInWord;
      thisCharCorrect = true;
    }
  }

  if (Config.mode == "zen") {
    thisCharCorrect = true;
  }

  if (char === "’" && nextCharInWord == "'") {
    char = "'";
    thisCharCorrect = true;
  }

  if (char === "'" && nextCharInWord == "’") {
    char = "’";
    thisCharCorrect = true;
  }

  if (char === "”" && nextCharInWord == '"') {
    char = '"';
    thisCharCorrect = true;
  }

  if (char === '"' && nextCharInWord == "”") {
    char = "”";
    thisCharCorrect = true;
  }

  if ((char === "–" || char === "—") && nextCharInWord == "-") {
    char = "-";
    thisCharCorrect = true;
  }

  if (
    Config.oppositeShiftMode === "on" &&
    ShiftTracker.isUsingOppositeShift(char) === false
  ) {
    thisCharCorrect = false;
  }

  if (!thisCharCorrect) {
    TestStats.incrementAccuracy(false);
    TestStats.incrementKeypressErrors();
    // currentError.count++;
    // currentError.words.push(TestLogic.words.currentIndex);
    thisCharCorrect = false;
    TestStats.pushMissedWord(TestLogic.words.getCurrent());
  } else {
    TestStats.incrementAccuracy(true);
    thisCharCorrect = true;
    if (Config.mode == "zen") {
      //making the input visible to the user
      $("#words .active").append(`<letter class="correct">${char}</letter>`);
    }
  }

  if (thisCharCorrect) {
    Sound.playClick(Config.playSoundOnClick);
  } else {
    if (!Config.playSoundOnError || Config.blindMode) {
      Sound.playClick(Config.playSoundOnClick);
    } else {
      Sound.playError(Config.playSoundOnError);
    }
  }

  if (
    Config.oppositeShiftMode === "on" &&
    ShiftTracker.isUsingOppositeShift(char) === false
  )
    return;

  //update current corrected verison. if its empty then add the current char. if its not then replace the last character with the currently pressed one / add it
  if (TestLogic.corrected.current === "") {
    TestLogic.corrected.setCurrent(TestLogic.input.current + char);
  } else {
    let cil = TestLogic.input.current.length;
    if (cil >= TestLogic.corrected.current.length) {
      TestLogic.corrected.appendCurrent(char);
    } else if (!thisCharCorrect) {
      TestLogic.corrected.setCurrent(
        TestLogic.corrected.current.substring(0, cil) +
          char +
          TestLogic.corrected.current.substring(cil + 1)
      );
    }
  }
  TestStats.incrementKeypressCount();
  TestStats.pushKeypressWord(TestLogic.words.currentIndex);
  // currentKeypress.count++;
  // currentKeypress.words.push(TestLogic.words.currentIndex);

  if (Config.stopOnError == "letter" && !thisCharCorrect) {
    return;
  }

  //update the active word top, but only once
  if (
    TestLogic.input.current.length === 1 &&
    TestLogic.words.currentIndex === 0
  ) {
    TestUI.setActiveWordTop(document.querySelector("#words .active").offsetTop);
  }

  //max length of the input is 20 unless in zen mode then its 30
  if (
    (Config.mode == "zen" && TestLogic.input.current.length < 30) ||
    (Config.mode !== "zen" && TestLogic.input.current.length < TestLogic.words.getCurrent().length + 20)
  ) {
    TestLogic.input.appendCurrent(char);
  }

  if (!thisCharCorrect && Config.difficulty == "master") {
    TestLogic.fail();
    return;
  }

  //keymap
  if (Config.keymapMode === "react") {
    Keymap.flashKey(char, thisCharCorrect);
  } else if (Config.keymapMode === "next" && Config.mode !== "zen") {
    Keymap.highlightKey(
      TestLogic.words
        .getCurrent()
        .substring(
          TestLogic.input.current.length,
          TestLogic.input.current.length + 1
        )
        .toString()
        .toUpperCase()
    );
  }

  let activeWordTopBeforeJump = TestUI.activeWordTop;
  TestUI.updateWordElement(!Config.blindMode);

  if (Config.mode != "zen") {
    //not applicable to zen mode
    //auto stop the test if the last word is correct
    let currentWord = TestLogic.words.getCurrent();
    let lastindex = TestLogic.words.currentIndex;
    if (
      (currentWord == TestLogic.input.current ||
        (Config.quickEnd &&
          currentWord.length == TestLogic.input.current.length &&
          Config.stopOnError == "off")) &&
      lastindex == TestLogic.words.length - 1
    ) {
      TestLogic.input.pushHistory();

      TestLogic.corrected.pushHistory();
      TestStats.setLastSecondNotRound();
      TestLogic.finish();
    }
  }

  //simulate space press in nospace funbox
  if (
    (Funbox.active === "nospace" &&
      TestLogic.input.current.length === TestLogic.words.getCurrent().length) ||
    (char === "\n" && thisCharCorrect)
  ) {
    handleSpace();
  }

  let newActiveTop = document.querySelector("#words .word.active").offsetTop;
  //stop the word jump by slicing off the last character, update word again
  if (
    activeWordTopBeforeJump < newActiveTop &&
    !TestUI.lineTransition &&
    TestLogic.input.current.length > 1
  ) {
    if (Config.mode == "zen") {
      let currentTop = Math.floor(
        document.querySelectorAll("#words .word")[
          TestUI.currentWordElementIndex - 1
        ].offsetTop
      );
      if (!Config.showAllLines) TestUI.lineJump(currentTop);
    } else {
      TestLogic.input.setCurrent(TestLogic.input.current.slice(0, -1));
      TestUI.updateWordElement(!Config.blindMode);
    }
  }

  Caret.updatePosition();

  let acc = Misc.roundTo2(TestStats.calculateAccuracy());
  LiveAcc.update(acc);
}

$(document).keyup((event) => {
  if (!event.originalEvent.isTrusted) return;

  if (TestUI.resultVisible) return;
  let now = performance.now();
  let diff = Math.abs(TestStats.keypressTimings.duration.current - now);
  if (TestStats.keypressTimings.duration.current !== -1) {
    TestStats.pushKeypressDuration(diff);
    // keypressStats.duration.array.push(diff);
  }
  TestStats.setKeypressDuration(now);
  // keypressStats.duration.current = now;
  Monkey.stop();
});

$(document).keydown(function (event) {
  if (!(event.key == " ") && !event.originalEvent.isTrusted) return;

  if (!TestUI.resultVisible) {
    TestStats.recordKeypressSpacing();
  }

  isCapsLockHeld = event.originalEvent.getModifierState("CapsLock");

  Monkey.type();

  //autofocus
  let pageTestActive = !$(".pageTest").hasClass("hidden");
  let commandLineVisible = !$("#commandLineWrapper").hasClass("hidden");
  let wordsFocused = $("#wordsInput").is(":focus");
  let modePopupVisible =
    !$("#customTextPopupWrapper").hasClass("hidden") ||
    !$("#customWordAmountPopupWrapper").hasClass("hidden") ||
    !$("#customTestDurationPopupWrapper").hasClass("hidden") ||
    !$("#quoteSearchPopupWrapper").hasClass("hidden") ||
    !$("#wordFilterPopupWrapper").hasClass("hidden");
  if (
    pageTestActive &&
    !commandLineVisible &&
    !modePopupVisible &&
    !TestUI.resultVisible &&
    !wordsFocused &&
    event.key !== "Enter"
  ) {
    TestUI.focusWords();
    wordsFocused = true;
    if (Config.showOutOfFocusWarning) return;
  }

  //tab
  if (
    (event.key == "Tab" && !Config.swapEscAndTab) ||
    (event.key == "Escape" && Config.swapEscAndTab)
  ) {
    handleTab(event);
  }

  //blocking firefox from going back in history with backspace
  if (event.key === "Backspace" && wordsFocused) {
    let t = /INPUT|SELECT|TEXTAREA/i;
    if (
      !t.test(event.target.tagName) ||
      event.target.disabled ||
      event.target.readOnly
    ) {
      event.preventDefault();
    }
  }

  TestStats.setKeypressDuration(performance.now());

  if (TestUI.testRestarting) {
    return;
  }

  //backspace
  const isBackspace =
    event.key === "Backspace" ||
    (Config.capsLockBackspace && event.key === "CapsLock");
  if (isBackspace && wordsFocused) {
    handleBackspace(event);
  }

  if (event.key === "Enter") {
    if (event.shiftKey && Config.mode == "zen") {
      TestLogic.finish();
    }
    if (
      event.shiftKey &&
      ((Config.mode == "time" && Config.time === 0) ||
        (Config.mode == "words" && Config.words === 0))
    ) {
      TestLogic.setBailout(true);
      TestLogic.finish();
    }
  }

  if (
    [
      "ContextMenu",
      "Escape",
      "Shift",
      "Control",
      "Meta",
      "Alt",
      "AltGraph",
      "CapsLock",
      "Backspace",
      "PageUp",
      "PageDown",
      "Home",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "OS",
      "Insert",
      "Home",
      "Undefined",
      "Control",
      "Fn",
      "FnLock",
      "Hyper",
      "NumLock",
      "ScrollLock",
      "Symbol",
      "SymbolLock",
      "Super",
      "Unidentified",
      "Process",
      "Delete",
      "KanjiMode",
      "Pause",
      "PrintScreen",
      "Clear",
      "End",
      undefined,
    ].includes(event.key)
  ) {
    TestStats.incrementKeypressMod();
  }

  //show dead keys
  if (event.key === "Dead") {
    Sound.playClick(Config.playSoundOnClick);
    $(
      document.querySelector("#words .word.active").querySelectorAll("letter")[
        TestLogic.input.current.length
      ]
    ).toggleClass("dead");
    return;
  }

  //default layout is handled in input event
  if (Config.layout !== "default") {
    let char = LayoutEmulator.getCharFromEvent(event);
    if (char) handleAlpha(char);
  }
});

$("#wordsInput").on("input", function (event) {
  if (TestUI.testRestarting) return;

  //layout emulation is handled in keypress event
  if (Config.layout !== "default") {
    event.target.value = "";
    return;
  }

  let char = event.target.value;

  if (Config.capsLockBackspace && isCapsLockHeld) {
    //swap case
    char = char == char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
  }

  handleAlpha(char);

  event.target.value = "";
});
